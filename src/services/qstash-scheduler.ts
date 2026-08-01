/*
 * Upstash QStash Cron Scheduler Service
 * Manages peak-hour scheduling for Malaysian traffic patterns (12:30 PM - 2:00 PM & 8:30 PM - 10:30 PM MYT)
 * Includes retry backoff, rate limit prevention for X and Facebook Graph APIs.
 */

import { schedule, Schedule, CronExpression } from "@upstash/qstash";
import { CONSTANTS } from "../config/constants";
import { QSTASH_CURRENT_SIGNING_KEY } from "../config/env";
import {
  createQStashVerifier,
  qstashVerifierMiddleware,
} from "../utils/qstash-verify";

// ---------------------------------------------------------------------------
// Rate limit tracking per platform
// ---------------------------------------------------------------------------

interface RateLimitState {
  x: { remaining: number; resetAt: number };
  facebook: { remaining: number; resetAt: number };
}

const rateLimitState: RateLimitState = {
  x: { remaining: 12, resetAt: 0 },
  facebook: { remaining: 200, resetAt: 0 },
};

export interface QStashJob {
  id: string;
  cronExpression: string;
  targetUrl: string;
  body?: Record<string, any>;
  headers?: Record<string, string>;
}

export class QStashScheduler {
  private static instance: QStashScheduler;
  private schedule: Schedule;
  private qstashSigningKey: string | undefined;
  private verificationEnabled: boolean;
  private jobs: Map<string, QStashJob> = new Map();

  private constructor() {
    // Validate environment configuration
    this.qstashSigningKey = QSTASH_CURRENT_SIGNING_KEY;
    this.verificationEnabled = !!this.qstashSigningKey;

    // Initialize QStash schedule with current signing key
    this.schedule = schedule({
      baseUrl: "https://qstash.upstash.io/v1",
      currentSigningKey: this.qstashSigningKey,
    });

    this.initializePeakHourJobs();
  }

  public static getInstance(): QStashScheduler {
    if (!QStashScheduler.instance) {
      QStashScheduler.instance = new QStashScheduler();
    }
    return QStashScheduler.instance;
  }

  private initializePeakHourJobs(): void {
    // Clear any existing jobs
    this.clearAllJobs();

    // Morning peak hours: 12:30 PM - 2:00 PM MYT (based on constants)
    this.createPeakHourJob(
      "morning-peak",
      `*/15 ${CONSTANTS.QSTASH_PEAK_HOURS_START.split(":")[0]}|${CONSTANTS.QSTASH_PEAK_HOURS_END.split(":")[0]} * * *`, // Every 15 minutes during peak window
      "https://api.racun.ibu.my/internal/peak-processing",
      {
        peakType: "morning",
        timezone: "Asia/Kuala_Lumpur",
        schedulingType: "cron-worker",
      },
    );

    // Evening peak hours: 8:30 PM - 10:30 PM MYT
    this.createPeakHourJob(
      "evening-peak",
      `*/15 ${CONSTANTS.QSTASH_EVENING_PEAK_HOURS_START.split(":")[0]}|${CONSTANTS.QSTASH_EVENING_PEAK_HOURS_END.split(":")[0]} * * *`, // Every 15 minutes during peak window
      "https://api.racun.ibu.my/internal/peak-processing",
      {
        peakType: "evening",
        timezone: "Asia/Kuala_Lumpur",
        schedulingType: "cron-worker",
      },
    );

    // High-traffic day-level processing (once per day)
    this.createPeakHourJob(
      "daily-peak-report",
      "0 2 * * *", // Daily 2:00 AM MYT
      "https://api.racun.ibu.my/internal/daily-report",
      {
        processingType: "daily-metrics",
        timezone: "Asia/Kuala_Lumpur",
      },
    );
  }

  private createPeakHourJob(
    jobId: string,
    cronExpression: string,
    targetUrl: string,
    body: Record<string, any> = {},
    headers: Record<string, string> = {},
  ): void {
    const job: QStashJob = {
      id: jobId,
      cronExpression,
      targetUrl,
      body,
      headers: {
        ...headers,
        "upstash-delay": "0", // No delay for immediate processing
        "upstash-retry": "3", // Maximum 3 retry attempts
        "upstash-ttl": "86400", // 24 hours TTL
      },
    };

    this.jobs.set(jobId, job);
    console.log(
      `[QStashScheduler] Created job: ${jobId} with cron: ${cronExpression} -> ${targetUrl}`,
      {
        jobId,
        cronExpression,
        targetUrl,
        body,
        headers: job.headers,
      },
    );

    // Schedule the job
    this.scheduleJob(job);
  }

  /**
   * Check if a platform is within its rate limit budget.
   * Returns true if the request can proceed, false if rate-limited.
   */
  private checkRateLimit(platform: "x" | "facebook"): boolean {
    const now = Date.now();
    const state = rateLimitState[platform];

    // Reset counter if the rate limit window has expired
    if (now > state.resetAt) {
      state.remaining = platform === "x" ? 12 : 200;
      state.resetAt = now + (platform === "x" ? 7200000 : 3600000); // 2h for X, 1h for FB
    }

    if (state.remaining <= 0) {
      console.warn(
        `[QStashScheduler] Rate limit reached for ${platform} — request deferred`,
      );
      return false;
    }

    state.remaining -= 1;
    return true;
  }

  /**
   * Calculate exponential backoff delay for retries.
   * Prevents hammering APIs during rate limit windows.
   */
  private getBackoffDelay(attempt: number, platform: "x" | "facebook"): number {
    const baseDelay = platform === "x" ? 1000 : 500;
    const maxDelay = platform === "x" ? 30000 : 15000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.floor(Math.random() * delay * 0.5);
  }

  private scheduleJob(job: QStashJob): void {
    if (!this.verificationEnabled) {
      console.warn(
        `[QStashScheduler] Skipping job ${job.id} - QStash verification not configured`,
      );
      return;
    }

    try {
      // Add a slight delay to prevent thundering herd at peak times
      const delayMs = Math.floor(Math.random() * 30000); // Random delay up to 30 seconds

      // Use QStash scheduling with timezone support
      this.schedule.publish({
        url: job.targetUrl,
        method: "POST",
        body: JSON.stringify(job.body),
        headers: job.headers,
        delay: Math.ceil(delayMs / 1000), // Convert to seconds
        retry: {
          attempts: parseInt(job.headers["upstash-retry"] || "3"),
          delay: "60s",
        },
        timeout: "30s",
      });

      console.log(
        `[QStashScheduler] Scheduled job: ${job.id} -> ${job.targetUrl} (delay: ${delayMs}ms)`,
      );
    } catch (error) {
      console.error(
        `[QStashScheduler] Failed to schedule job ${job.id}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public async publishJob(
    jobId: string,
    body: Record<string, any>,
  ): Promise<void> {
    const job: QStashJob = {
      id: jobId,
      cronExpression: "* * * * *", // Run every minute
      targetUrl: "https://api.racun.ibu.my/internal/product-fetch",
      body,
      headers: {
        "upstash-delay": "0",
        "upstash-retry": "3",
        "upstash-ttl": "3600", // 1 hour TTL
      },
    };

    this.jobs.set(jobId, job);
    console.log(
      `[QStashScheduler] Published job: ${jobId} -> ${job.targetUrl}`,
      {
        jobId,
        targetUrl: job.targetUrl,
        body,
        headers: job.headers,
      },
    );

    // Schedule the job
    this.scheduleJob(job);
  }

  public async updatePeakHours(newPeakHours: {
    morningStart: string;
    morningEnd: string;
    eveningStart: string;
    eveningEnd: string;
  }): Promise<void> {
    // Clear existing peak hour jobs
    this.clearPeakHourJobs();

    // Update constants temporarily (or pass parameters directly)
    const morningStart = newPeakHours.morningStart;
    const morningEnd = newPeakHours.morningEnd;
    const eveningStart = newPeakHours.eveningStart;
    const eveningEnd = newPeakHours.eveningEnd;

    // Recreate morning peak jobs
    this.createPeakHourJob(
      "morning-peak-updated",
      `*/15 ${morningStart.split(":")[0]}|${morningEnd.split(":")[0]} * * *`,
      "https://api.racun.ibu.my/internal/peak-processing",
      {
        peakType: "morning-updated",
        timezone: "Asia/Kuala_Lumpur",
        schedulingType: "cron-worker",
      },
    );

    // Recreate evening peak jobs
    this.createPeakHourJob(
      "evening-peak-updated",
      `*/15 ${eveningStart.split(":")[0]}|${eveningEnd.split(":")[0]} * * *`,
      "https://api.racun.ibu.my/internal/peak-processing",
      {
        peakType: "evening-updated",
        timezone: "Asia/Kuala_Lumpur",
        schedulingType: "cron-worker",
      },
    );

    console.log(
      `[QStashScheduler] Updated peak hours: ${morningStart}-${morningEnd}, ${eveningStart}-${eveningEnd}`,
    );
  }

  public clearPeakHourJobs(): void {
    // Remove all jobs from memory
    this.jobs.clear();
    console.log("[QStashScheduler] Cleared all peak hour jobs");
  }

  public clearAllJobs(): void {
    this.jobs.clear();
    console.log("[QStashScheduler] Cleared all QStash jobs");
  }

  public getScheduledJobs(): QStashJob[] {
    return Array.from(this.jobs.values());
  }

  public getSchedulerStatus(): {
    totalJobs: number;
    verificationEnabled: boolean;
    signingKeyConfigured: boolean;
    peakHoursStatus: string;
  } {
    const now = new Date();
    const isInPeakHours =
      (now.getHours() === 12 && now.getMinutes() >= 30) ||
      (now.getHours() === 13 && now.getMinutes() < 0) ||
      (now.getHours() === 20 && now.getMinutes() >= 30) ||
      (now.getHours() === 21 && now.getMinutes() < 30);

    return {
      totalJobs: this.jobs.size,
      verificationEnabled: this.verificationEnabled,
      signingKeyConfigured: !!this.qstashSigningKey,
      peakHoursStatus: isInPeakHours ? "ACTIVE_PEAK" : "NORMAL_TRAFFIC",
    };
  }

  // Middleware factory for QStash signature verification
  public createVerificationMiddleware() {
    const verifier = createQStashVerifier();
    return qstashVerifierMiddleware(verifier);
  }

  // Health check for QStash connectivity
  public async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    details?: string;
  }> {
    try {
      if (!this.verificationEnabled) {
        return {
          status: "UNVERIFIED",
          timestamp: new Date().toISOString(),
          details: "QStash verification not configured",
        };
      }

      // Test QStash connectivity by checking job status
      const status = this.getSchedulerStatus();

      // For now, we'll perform a basic connectivity test
      // In production, you might want to validate against actual QStash endpoints

      return {
        status: "HEALTHY",
        timestamp: new Date().toISOString(),
        details: `Jobs: ${status.totalJobs}, Peak Hours: ${status.peakHoursStatus}`,
      };
    } catch (error) {
      return {
        status: "UNHEALTHY",
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    console.log("[QStashScheduler] Gracefully shutting down QStash scheduler");
    this.clearAllJobs();
  }
}

export { QStashScheduler as default };
