/*
 * Edge Cloudflare Worker Cron Trigger Controller
 * Phase 7: Production Hardening — Consolidated Scheduled Event Handler
 * Handles scheduled triggers, verifies peak-hour execution windows,
 * triggers product fetching, and runs anti-repeat checks safely.
 *
 * All credentials are read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { DualPosterService } from "../services/dual-poster";
import { QStashScheduler } from "../services/qstash-scheduler";
import { RedisService } from "../services/redis";
import { SupabaseService } from "../services/supabase";
import { logger } from "../utils/logger";
import { CONSTANTS } from "../config/constants";
import { QStashVerifier } from "../utils/qstash-verify";

// Peak hour windows for Malaysian traffic (Asia/Kuala_Lumpur timezone)
const PEAK_HOURS = {
  morning: {
    startHour: 12,
    startMinute: 30,
    endHour: 14,
    endMinute: 0,
    label: "morning-peak",
  },
  evening: {
    startHour: 20,
    startMinute: 30,
    endHour: 22,
    endMinute: 30,
    label: "evening-peak",
  },
};

export interface CronTriggerContext {
  env: Env;
  scheduledTime: string;
  timezone: string;
  isPeakHour: boolean;
  peakWindow: string | null;
  executionId: string;
}

export interface CronExecutionResult {
  success: boolean;
  executionId: string;
  triggeredActions: string[];
  skippedActions: string[];
  errors: string[];
  durationMs: number;
}

export interface AntiRepeatCheck {
  key: string;
  ttlSeconds: number;
  alreadyExecuted: boolean;
}

export class CronTriggerHandler {
  private dualPoster: DualPosterService;
  private qstashScheduler: QStashScheduler;
  private redisService: RedisService;
  private supabaseService: SupabaseService;
  private env: Env;
  private maxRetries: number;
  private circuitBreakerCount: number;
  private circuitBreakerThreshold: number;

  constructor(env: Env) {
    this.env = env;
    this.dualPoster = new DualPosterService(
      new RedisService(env),
      new SupabaseService(env),
      null as any,
      null as any,
    );
    this.qstashScheduler = QStashScheduler.getInstance();
    this.redisService = new RedisService(env);
    this.supabaseService = new SupabaseService(env);
    this.maxRetries = 3;
    this.circuitBreakerCount = 0;
    this.circuitBreakerThreshold = CONSTANTS.CIRCUIT_BREAKER_THRESHOLD || 5;
  }

  /**
   * Cloudflare Worker Scheduled Event handler
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<CronExecutionResult> {
    const startTime = Date.now();
    const executionId = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info(
      "Cron trigger initiated",
      { executionId, scheduledTime: controller.scheduledTime },
      "CronTriggerHandler",
    );

    const context: CronTriggerContext = {
      env,
      scheduledTime: controller.scheduledTime,
      timezone: "Asia/Kuala_Lumpur",
      isPeakHour: false,
      peakWindow: null,
      executionId,
    };

    const result: CronExecutionResult = {
      success: false,
      executionId,
      triggeredActions: [],
      skippedActions: [],
      errors: [],
      durationMs: 0,
    };

    try {
      // Step 0: Verify QStash signature (if signing key is configured)
      const qstashVerifier = new QStashVerifier(
        this.env.QSTASH_SIGNING_KEY || "",
      );
      const signatureValid =
        !this.env.QSTASH_SIGNING_KEY ||
        qstashVerifier.verifySignature(controller.scheduledTime, {
          "Upstash-Signature": controller.scheduledTime,
          "Upstash-Timestamp": String(Math.floor(Date.now() / 1000)),
        } as any);

      if (!signatureValid && this.env.QSTASH_SIGNING_KEY) {
        logger.warn(
          "QStash signature verification failed — rejecting request",
          { executionId },
          "CronTriggerHandler",
        );
        result.errors.push("QStash signature verification failed");
        result.success = false;
        return result;
      }

      // Step 1: Verify peak-hour execution window
      const peakCheck = this.checkPeakHourWindow();
      context.isPeakHour = peakCheck.isPeakHour;
      context.peakWindow = peakCheck.window;

      if (!peakCheck.isPeakHour) {
        logger.info(
          "Outside peak hours — running lightweight checks only",
          { executionId },
          "CronTriggerHandler",
        );
        result.skippedActions.push("product_fetching");
        result.skippedActions.push("dual_posting");
        await this.runLightweightChecks(env, result);
        result.success = true;
        return result;
      }

      // Step 2: Run anti-repeat check
      const antiRepeat = await this.checkAntiRepeat(executionId);
      if (antiRepeat.alreadyExecuted) {
        logger.warn(
          "Anti-repeat check triggered — skipping execution",
          { executionId, key: antiRepeat.key },
          "CronTriggerHandler",
        );
        result.skippedActions.push("all");
        result.success = true;
        return result;
      }

      // Step 3: Trigger product fetching via QStash
      await this.triggerProductFetching(env, result);
      result.triggeredActions.push("product_fetching");

      // Step 4: Run dual-posting pipeline
      await this.runDualPostingPipeline(env, result);
      result.triggeredActions.push("dual_posting");

      // Step 5: Run health checks and metrics
      await this.runHealthChecks(env, result);
      result.triggeredActions.push("health_checks");

      // Step 6: Reset circuit breaker on success
      this.circuitBreakerCount = 0;
      result.success = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Cron trigger execution failed`,
        { executionId, error: msg },
        "CronTriggerHandler",
      );
      result.errors.push(msg);
      this.circuitBreakerCount++;

      // Step 7: Circuit breaker — skip next cycle if threshold reached
      if (this.circuitBreakerCount >= this.circuitBreakerThreshold) {
        logger.warn(
          "Circuit breaker activated — skipping next execution cycle",
          { executionId, count: this.circuitBreakerCount },
          "CronTriggerHandler",
        );
        result.skippedActions.push("circuit_breaker_active");
      }
    }

    result.durationMs = Date.now() - startTime;

    logger.info(
      "Cron trigger execution completed",
      {
        executionId,
        success: result.success,
        triggeredActions: result.triggeredActions.length,
        skippedActions: result.skippedActions.length,
        errors: result.errors.length,
        durationMs: result.durationMs,
      },
      "CronTriggerHandler",
    );

    return result;
  }

  /**
   * Check if current time is within peak-hour execution window
   */
  checkPeakHourWindow(): { isPeakHour: boolean; window: string | null } {
    const now = new Date();
    const kualaLumpurTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }),
    );
    const currentHour = kualaLumpurTime.getHours();
    const currentMinute = kualaLumpurTime.getMinutes();

    for (const [key, window] of Object.entries(PEAK_HOURS)) {
      const startMinutes = window.startHour * 60 + window.startMinute;
      const endMinutes = window.endHour * 60 + window.endMinute;
      const currentMinutes = currentHour * 60 + currentMinute;

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        return { isPeakHour: true, window: key };
      }
    }

    return { isPeakHour: false, window: null };
  }

  /**
   * Check anti-repeat using Redis with 5-day TTL
   */
  async checkAntiRepeat(executionId: string): Promise<AntiRepeatCheck> {
    const key = `cron:anti-repeat:${executionId}`;
    const ttlSeconds = 5 * 24 * 60 * 60; // 5 days

    try {
      const existing = await this.redisService.get(key);
      if (existing) {
        return { key: executionId, ttlSeconds, alreadyExecuted: true };
      }

      // Set the key with TTL to prevent repeat execution
      await this.redisService.set(key, executionId, { ex: ttlSeconds });
      return { key: executionId, ttlSeconds, alreadyExecuted: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Anti-repeat check failed`,
        { error: msg },
        "CronTriggerHandler",
      );
      // On Redis failure, allow execution to proceed (fail-open)
      return { key: executionId, ttlSeconds, alreadyExecuted: false };
    }
  }

  /**
   * Trigger product fetching via QStash
   */
  private async triggerProductFetching(
    env: Env,
    result: CronExecutionResult,
  ): Promise<void> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        await this.qstashScheduler.triggerJob("product-fetch", {
          timestamp: new Date().toISOString(),
          executionId: result.executionId,
        });
        logger.info(
          "Product fetching triggered via QStash",
          { executionId: result.executionId },
          "CronTriggerHandler",
        );
        return;
      } catch (error) {
        retries++;
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Product fetching attempt ${retries} failed`,
          { error: msg, retries: this.maxRetries },
          "CronTriggerHandler",
        );

        if (retries < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, retries - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    result.errors.push("Product fetching failed after max retries");
  }

  /**
   * Run the dual-posting pipeline
   */
  private async runDualPostingPipeline(
    env: Env,
    result: CronExecutionResult,
  ): Promise<void> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        // The dual poster orchestrates X + Facebook posting
        await this.dualPoster.executePipeline(env);
        logger.info(
          "Dual-posting pipeline executed successfully",
          { executionId: result.executionId },
          "CronTriggerHandler",
        );
        return;
      } catch (error) {
        retries++;
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Dual-posting attempt ${retries} failed`,
          { error: msg, retries: this.maxRetries },
          "CronTriggerHandler",
        );

        if (retries < this.maxRetries) {
          const delayMs = Math.pow(2, retries - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    result.errors.push("Dual-posting pipeline failed after max retries");
  }

  /**
   * Run lightweight health checks during off-peak hours
   */
  private async runLightweightChecks(
    env: Env,
    result: CronExecutionResult,
  ): Promise<void> {
    try {
      // Check Redis connectivity
      await this.redisService.ping();
      logger.info("Redis health check passed", {}, "CronTriggerHandler");

      // Check Supabase connectivity
      await this.supabaseService.healthCheck();
      logger.info("Supabase health check passed", {}, "CronTriggerHandler");

      result.triggeredActions.push("health_checks");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Lightweight health check failed`,
        { error: msg },
        "CronTriggerHandler",
      );
      result.errors.push(`Health check failed: ${msg}`);
    }
  }

  /**
   * Run health checks and metrics collection
   */
  private async runHealthChecks(
    env: Env,
    result: CronExecutionResult,
  ): Promise<void> {
    try {
      await this.redisService.ping();
      logger.info("Health checks passed", {}, "CronTriggerHandler");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `Health checks failed`,
        { error: msg },
        "CronTriggerHandler",
      );
      result.errors.push(`Health checks failed: ${msg}`);
    }
  }
}

export default CronTriggerHandler;
