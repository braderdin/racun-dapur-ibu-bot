/*
 * Global Error Boundary & Graceful Recovery Module
 * Phase 6: Isolation wrappers and fallback mechanisms for API failures
 * Prevents Cloudflare Worker context crashes during unexpected errors
 */

import { logger } from "./logger";
import { CONSTANTS } from "../config/constants";

export interface ErrorContext {
  operation: string;
  timestamp: number;
  error: Error;
  stack?: string;
  additionalInfo?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  name: string;
  shouldRecover: (error: Error) => boolean;
  recover: (error: Error, context: ErrorContext) => Promise<any>;
  maxRetries?: number;
  backoffMs?: number;
}

export interface ErrorBoundaryConfig {
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  enableGracefulDegradation: boolean;
  enableLogging: boolean;
}

export interface CircuitBreakerState {
  count: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
}

export class GlobalErrorBoundary {
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private errorHistory: ErrorContext[];
  private config: ErrorBoundaryConfig;

  constructor(config?: Partial<ErrorBoundaryConfig>) {
    this.circuitBreakers = new Map();
    this.errorHistory = [];
    this.config = {
      enableCircuitBreaker: true,
      circuitBreakerThreshold: CONSTANTS.UPSTASH_VECTOR_CIRCUIT_BREAKER_THRESHOLD || 3,
      circuitBreakerTimeoutMs: CONSTANTS.UPSTASH_VECTOR_CIRCUIT_BREAKER_TIMEOUT || 300000,
      enableGracefulDegradation: true,
      enableLogging: true,
      ...config,
    };

    logger.info("GlobalErrorBoundary initialized", {
      enableCircuitBreaker: this.config.enableCircuitBreaker,
      enableGracefulDegradation: this.config.enableGracefulDegradation,
    }, "GlobalErrorBoundary");
  }

  async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>,
    options: {
      allowGracefulDegradation?: boolean;
      circuitBreakerKey?: string;
      onSuccess?: (result: T) => void;
      onError?: (error: Error, context: ErrorContext) => Promise<any>;
    } = {}
  ): Promise<T> {
    const context: ErrorContext = {
      operation,
      timestamp: Date.now(),
      error: new Error("Not yet set"),
    };

    try {
      // Check circuit breaker state
      if (this.config.enableCircuitBreaker) {
        const circuitBreakerKey = options.circuitBreakerKey || operation;
        if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
          logger.warn("Circuit breaker open - using graceful degradation", {
            operation,
            circuitBreakerKey,
          }, "GlobalErrorBoundary");

          if (!this.config.enableGracefulDegradation) {
            throw new Error(`Circuit breaker open for operation: ${operation}`);
          }

          // Use graceful degradation
          return this.handleGracefulDegradation(operation, options);
        }
      }

      // Execute the operation
      const result = await fn();
      context.error = new Error("Success");

      // Record success
      if (options.circuitBreakerKey) {
        this.recordSuccess(options.circuitBreakerKey);
      }

      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      logger.info("Operation completed successfully", {
        operation,
        circuitBreakerKey: options.circuitBreakerKey,
      }, "GlobalErrorBoundary");

      return result;
    } catch (error) {
      // Record error
      context.error = error instanceof Error ? error : new Error(String(error));

      if (options.circuitBreakerKey) {
        this.recordFailure(options.circuitBreakerKey, context.error);
      }

      logger.error("Operation failed", {
        operation,
        error: context.error.message,
        stack: context.stack,
        circuitBreakerKey: options.circuitBreakerKey,
      }, "GlobalErrorBoundary");

      // Call error handler
      if (options.onError) {
        try {
          const fallbackResult = await options.onError(error as Error, context);
          logger.info("Error handler provided fallback result", {
            operation,
            fallbackResult: typeof fallbackResult,
          }, "GlobalErrorBoundary");
          return fallbackResult as T;
        } catch (handlerError) {
          logger.error("Error handler failed", {
            operation,
            handlerError: handlerError instanceof Error ? handlerError.message : String(handlerError),
          }, "GlobalErrorBoundary");
        }
      }

      // Re-throw if no graceful degradation
      if (!this.config.enableGracefulDegradation) {
        throw error;
      }

      // Use graceful degradation
      return this.handleGracefulDegradation(operation, options);
    }
  }

  private async handleGracefulDegradation<T>(
    operation: string,
    options: {
      allowGracefulDegradation?: boolean;
    } = {}
  ): Promise<T> {
    logger.warn("Using graceful degradation for operation", {
      operation,
      allowGracefulDegradation: options.allowGracefulDegradation ?? true,
    }, "GlobalErrorBoundary");

    // Return safe defaults or empty results based on operation type
    switch (operation) {
      case "fetchLazadaDeals":
      case "fetchShopeeDeals":
        return [] as unknown as T;
      case "generateAIContent":
        return {
          tweet1: { content: "", isHook: false },
          tweet2: { content: "", affiliateUrl: "" },
          threadType: "2-tweet-thread",
          platform: "x",
        } as unknown as T;
      case "postToX":
      case "postToFacebook":
        return {
          success: false,
          message: "Service temporarily unavailable",
          retryAfter: 30,
        } as unknown as T;
      case "uploadToB2Storage":
        return {
          success: false,
          error: "Storage service unavailable",
          retryAfter: 15,
        } as unknown as T;
      default:
        // For unknown operations, throw original error
        throw new Error(`Unable to gracefully degrade operation: ${operation}`);
    }
  }

  public isCircuitBreakerOpen(key: string): boolean {
    if (!this.config.enableCircuitBreaker) return false;

    const state = this.circuitBreakers.get(key);
    if (!state) return false;

    switch (state.state) {
      case "OPEN":
        if (Date.now() - state.lastFailureTime >= state.timeoutMs) {
          // Transition to half-open
          state.state = "HALF_OPEN";
          state.failureCount = 0;
          logger.info("Circuit breaker transitioning to HALF_OPEN", {
            key,
          }, "GlobalErrorBoundary");
          return false;
        }
        return true;
      case "HALF_OPEN":
        return false; // Allow one attempt
      case "CLOSED":
        return false;
      default:
        return false;
    }
  }

  private recordSuccess(key: string): void {
    const state = this.circuitBreakers.get(key);
    if (!state) return;

    if (state.state === "HALF_OPEN") {
      state.state = "CLOSED";
      state.failureCount = 0;
      logger.info("Circuit breaker closed after successful operation", {
        key,
      }, "GlobalErrorBoundary");
    }

    state.lastSuccessTime = Date.now();
    state.failureCount = 0;
  }

  private recordFailure(key: string, error: Error): void {
    let state = this.circuitBreakers.get(key);

    if (!state) {
      state = {
        count: 0,
        lastFailureTime: Date.now(),
        lastSuccessTime: Date.now(),
        state: "CLOSED",
        failureCount: 1,
      };
      this.circuitBreakers.set(key, state);
    }

    state.count++;
    state.lastFailureTime = Date.now();
    state.failureCount++;

    if (state.state === "HALF_OPEN") {
      state.state = "OPEN";
      logger.warn("Circuit breaker opened after half-open attempt", {
        key,
        failureCount: state.failureCount,
      }, "GlobalErrorBoundary");
    } else if (state.failureCount >= this.config.circuitBreakerThreshold) {
      state.state = "OPEN";
      logger.warn("Circuit breaker opened - threshold exceeded", {
        key,
        failureCount: state.failureCount,
        threshold: this.config.circuitBreakerThreshold,
      }, "GlobalErrorBoundary");
    }
  }

  public getCircuitBreakerStatus(key: string): {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failureCount: number;
    lastFailureTime: number;
    timeToRecoverMs: number;
  } {
    const state = this.circuitBreakers.get(key);
    if (!state) {
      return {
        state: "CLOSED",
        failureCount: 0,
        lastFailureTime: 0,
        timeToRecoverMs: 0,
      };
    }

    let timeToRecoverMs = 0;
    if (state.state === "OPEN") {
      timeToRecoverMs = Math.max(0, state.timeoutMs - (Date.now() - state.lastFailureTime));
    }

    return {
      state: state.state,
      failureCount: state.failureCount,
      lastFailureTime: state.lastFailureTime,
      timeToRecoverMs,
    };
  }

  public resetCircuitBreaker(key: string): void {
    const state = this.circuitBreakers.get(key);
    if (state) {
      state.state = "CLOSED";
      state.failureCount = 0;
      logger.info("Circuit breaker manually reset", {
        key,
      }, "GlobalErrorBoundary");
    }
  }

  public getErrorHistory(filter?: {
    operation?: string;
    fromTime?: number;
    toTime?: number;
    limit?: number;
  }): ErrorContext[] {
    let filtered = this.errorHistory.slice();

    if (filter?.operation) {
      filtered = filtered.filter((e) => e.operation === filter.operation);
    }

    if (filter?.fromTime) {
      filtered = filtered.filter((e) => e.timestamp >= filter.fromTime!);
    }

    if (filter?.toTime) {
      filtered = filtered.filter((e) => e.timestamp <= filter.toTime!);
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  public clearErrorHistory(): void {
    this.errorHistory = [];
    logger.info("Error history cleared", {}, "GlobalErrorBoundary");
  }

  public getServiceHealthStatus(): {
    totalOperations: number;
    failedOperations: number;
    healthyCircuitBreakers: number;
    degradedOperations: number;
  } {
    const totalOperations = this.errorHistory.length;
    const failedOperations = this.errorHistory.filter((e) => e.error.message !== "Success").length;
    const healthyCircuitBreakers = Array.from(this.circuitBreakers.values()).filter(
      (s) => s.state === "CLOSED"
    ).length;
    const degradedOperations = this.errorHistory.filter(
      (e) => e.error.message === "Graceful degradation applied"
    ).length;

    return {
      totalOperations,
      failedOperations,
      healthyCircuitBreakers,
      degradedOperations,
    };
  }
}

export { GlobalErrorBoundary as default };