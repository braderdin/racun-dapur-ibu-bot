/*
 * Facebook Graph API Auto-Comment Engagement Service
 * Automatically posts the first comment containing shortlink
 * affiliate calls-to-action within 3 seconds of the main
 * post publish on Facebook Page.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { delay } from "../utils/delay";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface FacebookEngagementConfig {
  commentDelayMs: number;
  maxRetries: number;
  retryDelayMs: number;
  commentTemplate: string;
  ctaPlaceholder: string;
  shortlinkPlaceholder: string;
}

export interface EngagementResult {
  success: boolean;
  postId: string;
  commentId?: string;
  commentText: string;
  latencyMs: number;
  retriesUsed: number;
  error?: string;
}

export interface CommentSchedule {
  postId: string;
  scheduledAt: string;
  commentText: string;
  status: "pending" | "posted" | "failed" | "retrying";
  attempts: number;
  commentId?: string;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: FacebookEngagementConfig = {
  commentDelayMs: 3000, // 3 seconds as per dual-posting protocol
  maxRetries: 3,
  retryDelayMs: 1000,
  commentTemplate:
    "Buat yang tertarik, klik pautan di bawah untuk dapatkan produk ini dengan harga terbaik hari ini! {shortlink} #RacunDapurIbu",
  ctaPlaceholder: "{shortlink}",
  shortlinkPlaceholder: "{shortlink}",
};

// ---------------------------------------------------------------------------
// Facebook Engagement Service
// ---------------------------------------------------------------------------

export class FacebookEngagementService {
  private config: FacebookEngagementConfig;
  private env: Env;
  private pendingComments: Map<string, CommentSchedule> = new Map();

  constructor(env: Env, config?: Partial<FacebookEngagementConfig>) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info(
      "FacebookEngagementService initialized",
      {
        commentDelayMs: this.config.commentDelayMs,
        maxRetries: this.config.maxRetries,
      },
      "FacebookEngagementService",
    );
  }

  // -----------------------------------------------------------------------
  // Schedule auto-comment for a published post
  // -----------------------------------------------------------------------

  async scheduleAutoComment(
    postId: string,
    shortlink: string,
    productName?: string,
  ): Promise<CommentSchedule> {
    const commentText = this.config.commentTemplate.replace(
      this.config.shortlinkPlaceholder,
      shortlink,
    );

    const schedule: CommentSchedule = {
      postId,
      scheduledAt: new Date(
        Date.now() + this.config.commentDelayMs,
      ).toISOString(),
      commentText,
      status: "pending",
      attempts: 0,
    };

    this.pendingComments.set(postId, schedule);

    logger.info(
      "Auto-comment scheduled",
      {
        postId,
        shortlink,
        scheduledAt: schedule.scheduledAt,
        delayMs: this.config.commentDelayMs,
      },
      "FacebookEngagementService",
    );

    // Execute the comment after the delay
    this.executeCommentAfterDelay(postId, shortlink);

    return schedule;
  }

  // -----------------------------------------------------------------------
  // Post comment immediately (for manual triggers)
  // -----------------------------------------------------------------------

  async postCommentImmediately(
    postId: string,
    shortlink: string,
  ): Promise<EngagementResult> {
    const startTime = Date.now();
    const commentText = this.config.commentTemplate.replace(
      this.config.shortlinkPlaceholder,
      shortlink,
    );

    const result = await this.executeComment(postId, commentText, 0);

    return {
      ...result,
      latencyMs: Date.now() - startTime,
    };
  }

  // -----------------------------------------------------------------------
  // Get pending comment status
  // -----------------------------------------------------------------------

  getPendingComment(postId: string): CommentSchedule | undefined {
    return this.pendingComments.get(postId);
  }

  // -----------------------------------------------------------------------
  // Cancel a pending comment
  // -----------------------------------------------------------------------

  cancelPendingComment(postId: string): boolean {
    const schedule = this.pendingComments.get(postId);
    if (schedule && schedule.status === "pending") {
      schedule.status = "failed";
      this.pendingComments.delete(postId);
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Internal: Execute comment after delay
  // -----------------------------------------------------------------------

  private async executeCommentAfterDelay(
    postId: string,
    shortlink: string,
  ): Promise<void> {
    // Wait for the configured delay (3 seconds)
    await delay(this.config.commentDelayMs);

    const schedule = this.pendingComments.get(postId);
    if (!schedule || schedule.status !== "pending") {
      logger.debug(
        "Comment schedule no longer pending, skipping",
        {
          postId,
        },
        "FacebookEngagementService",
      );
      return;
    }

    const commentText = this.config.commentTemplate.replace(
      this.config.shortlinkPlaceholder,
      shortlink,
    );

    schedule.status = "retrying";
    const result = await this.executeComment(postId, commentText, 0);

    if (result.success) {
      schedule.status = "posted";
      schedule.commentId = result.commentId;
    } else {
      schedule.status = "failed";
      schedule.attempts = result.retriesUsed;
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Execute comment with retry logic
  // -----------------------------------------------------------------------

  private async executeComment(
    postId: string,
    commentText: string,
    attempt: number,
  ): Promise<EngagementResult> {
    try {
      // Facebook Graph API endpoint for posting comments
      // POST /{post-id}/comments
      const accessToken = this.env.FB_PAGE_ACCESS_TOKEN || "";

      if (!accessToken) {
        return {
          success: false,
          postId,
          commentText,
          latencyMs: 0,
          retriesUsed: attempt,
          error: "Facebook Page Access Token not configured",
        };
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: commentText,
            access_token: accessToken,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data: { id: string } = await response.json();

      logger.info(
        "Facebook comment posted successfully",
        {
          postId,
          commentId: data.id,
          attempt,
        },
        "FacebookEngagementService",
      );

      return {
        success: true,
        postId,
        commentId: data.id,
        commentText,
        latencyMs: 0,
        retriesUsed: attempt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn(
        "Facebook comment failed, retrying",
        {
          postId,
          attempt,
          error: errorMessage,
        },
        "FacebookEngagementService",
      );

      // Retry with exponential backoff
      if (attempt < this.config.maxRetries) {
        const retryDelay = this.config.retryDelayMs * Math.pow(2, attempt);
        await delay(retryDelay);
        return this.executeComment(postId, commentText, attempt + 1);
      }

      return {
        success: false,
        postId,
        commentText,
        latencyMs: 0,
        retriesUsed: attempt,
        error: errorMessage,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createFacebookEngagementService(
  env: Env,
): FacebookEngagementService {
  return new FacebookEngagementService(env, {
    commentDelayMs: parseInt(env.FB_COMMENT_DELAY_MS || "3000", 10),
    maxRetries: parseInt(env.FB_COMMENT_MAX_RETRIES || "3", 10),
    retryDelayMs: parseInt(env.FB_COMMENT_RETRY_DELAY_MS || "1000", 10),
  });
}
