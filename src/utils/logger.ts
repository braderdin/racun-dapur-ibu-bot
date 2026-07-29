// Structured Edge Logger Utility for Cloudflare Workers
// Provides JSON-formatted logging with log-level support for Cloudflare Workers.
import { CONSTANTS } from "../config/constants";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

export interface LogEntry {
  timestamp: string; // ISO 8601 timestamp
  level: LogLevel; // Log level
  message: string; // Log message
  context?: any; // Optional additional context
  worker?: string; // Worker identifier (optional)
}

class EdgeLogger {
  private readonly level: LogLevel;
  private readonly includeTimestamp: boolean = true;
  private readonly prettyPrint: boolean = false;

  constructor(
    level: LogLevel = "INFO",
    options?: { includeTimestamp?: boolean; prettyPrint?: boolean },
  ) {
    this.level = level;
    if (options?.includeTimestamp !== undefined)
      this.includeTimestamp = options.includeTimestamp;
    if (options?.prettyPrint !== undefined)
      this.prettyPrint = options.prettyPrint;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };
    return levels[level] >= levels[this.level];
  }

  private format(entry: LogEntry): string {
    let output = "";

    if (this.includeTimestamp) {
      output += `[${entry.timestamp}] `;
    }

    // Build structured JSON log entry
    const logObj: any = {
      level: entry.level,
      message: entry.message,
    };

    if (entry.context) {
      logObj.context = entry.context;
    }
    if (entry.worker) {
      logObj.worker = entry.worker;
    }

    if (this.prettyPrint) {
      return JSON.stringify(logObj, null, 2);
    }

    // Compact JSON version for Cloudflare Workers compatibility
    output += JSON.stringify(logObj);

    return output;
  }

  private writeToOutput(formatted: string): void {
    // Cloudflare Workers compatible output (console.log in workers)
    console.log(formatted);
  }

  public error(message: string, context?: any, worker?: string): void {
    if (!this.shouldLog("ERROR")) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message,
      context,
      worker,
    };
    this.writeToOutput(this.format(entry));
  }

  public warn(message: string, context?: any, worker?: string): void {
    if (!this.shouldLog("WARN")) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
      context,
      worker,
    };
    this.writeToOutput(this.format(entry));
  }

  public info(message: string, context?: any, worker?: string): void {
    if (!this.shouldLog("INFO")) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      context,
      worker,
    };
    this.writeToOutput(this.format(entry));
  }

  public debug(message: string, context?: any, worker?: string): void {
    if (!this.shouldLog("DEBUG")) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "DEBUG",
      message,
      context,
      worker,
    };
    this.writeToOutput(this.format(entry));
  }

  // Convenience method to get current logger level
  public getLevel(): LogLevel {
    return this.level;
  }

  // Static convenience methods
  public static create(level: LogLevel = "INFO"): EdgeLogger {
    return new EdgeLogger(level);
  }
}

// Singleton logger instance for default use
let defaultLogger: EdgeLogger | undefined;

export function getLogger(level?: LogLevel): EdgeLogger {
  if (!defaultLogger) {
    defaultLogger = new EdgeLogger(level || "INFO");
  }
  return defaultLogger;
}

export const logger = getLogger();

// Export commonly used log levels
export const LOG_LEVELS = {
  ERROR: "ERROR" as const,
  WARN: "WARN" as const,
  INFO: "INFO" as const,
  DEBUG: "DEBUG" as const,
};
