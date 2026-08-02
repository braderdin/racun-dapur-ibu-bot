// Smart Comment Scheduler
// Manage jitter delays (3–8 seconds) before posting affiliate shortlinks into comment 1 (X auto-reply & FB comment) to bypass social platform anti-spam algorithms

import { Redis } from "@upstash/redis";

interface CommentSchedule {
  id: string;
  platform: "x" | "facebook";
  postId: string;
  commentType: "main" | "reply" | "auto-comment";
  scheduledAt: number;
  delay: number;
  status: "pending" | "processing" | "completed" | "failed";
  retryCount: number;
  maxRetries: number;
  content: {
    text: string;
    affiliateLink: string;
    metadata?: any;
  };
  createdAt: number;
  updatedAt: number;
}

interface JitterConfig {
  baseDelay: number;
  maxDelay: number;
  minDelay: number;
  variance: number;
  platform: "x" | "facebook";
}

interface AntiSpamConfig {
  x: JitterConfig;
  facebook: JitterConfig;
}

class SmartCommentScheduler {
  private redis: Redis;
  private antiSpamConfig: AntiSpamConfig;
  private processingQueue: Map<string, CommentSchedule>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.antiSpamConfig = {
      x: {
        baseDelay: 5,
        maxDelay: 8,
        minDelay: 3,
        variance: 2,
        platform: "x",
      },
      facebook: {
        baseDelay: 4,
        maxDelay: 7,
        minDelay: 2,
        variance: 1.5,
        platform: "facebook",
      },
    };

    this.processingQueue = new Map();
  }

  async scheduleComment(
    platform: "x" | "facebook",
    postId: string,
    commentType: "main" | "reply" | "auto-comment",
    content: { text: string; affiliateLink: string; metadata?: any },
  ): Promise<CommentSchedule> {
    try {
      const scheduleId = `${platform}:${postId}:${commentType}:${Date.now()}`;
      const config = this.antiSpamConfig[platform];

      const delay = this.calculateJitterDelay(config);
      const scheduledAt = Date.now() + delay * 1000;

      const schedule: CommentSchedule = {
        id: scheduleId,
        platform,
        postId,
        commentType,
        scheduledAt,
        delay,
        status: "pending",
        retryCount: 0,
        maxRetries: 3,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.redis.setex(
        `schedule:${scheduleId}`,
        86400,
        JSON.stringify(schedule),
      );
      await this.redis.zadd("schedules:pending", {
        score: scheduledAt,
        member: scheduleId,
      });

      this.startProcessingSchedule(scheduleId);

      return schedule;
    } catch (error) {
      console.error("Error scheduling comment:", error);
      throw error;
    }
  }

  private calculateJitterDelay(config: JitterConfig): number {
    const baseDelay = config.baseDelay;
    const variance = config.variance;
    const randomVariance = (Math.random() - 0.5) * 2 * variance;
    const delay = baseDelay + randomVariance;

    return Math.max(config.minDelay, Math.min(config.maxDelay, delay));
  }

  private async startProcessingSchedule(scheduleId: string): Promise<void> {
    try {
      const schedule = await this.getSchedule(scheduleId);
      if (!schedule) return;

      if (schedule.status === "completed" || schedule.status === "failed") {
        return;
      }

      this.processingQueue.set(scheduleId, schedule);

      setTimeout(async () => {
        await this.processSchedule(scheduleId);
      }, schedule.delay * 1000);
    } catch (error) {
      console.error(
        `Error starting processing for schedule ${scheduleId}:`,
        error,
      );
    }
  }

  private async processSchedule(scheduleId: string): Promise<void> {
    try {
      let schedule = this.processingQueue.get(scheduleId);
      if (!schedule) {
        const redisSchedule = await this.getSchedule(scheduleId);
        if (!redisSchedule) return;

        schedule = redisSchedule;
        this.processingQueue.set(scheduleId, schedule);
      }

      schedule.status = "processing";
      schedule.updatedAt = Date.now();
      this.processingQueue.set(scheduleId, schedule);

      await this.updateSchedule(scheduleId, {
        status: "processing",
        updatedAt: Date.now(),
      });

      const success = await this.executeComment(schedule);

      if (success) {
        schedule.status = "completed";
        await this.cleanupSchedule(scheduleId);
      } else {
        schedule.retryCount++;
        if (schedule.retryCount >= schedule.maxRetries) {
          schedule.status = "failed";
          await this.cleanupSchedule(scheduleId);
        } else {
          schedule.status = "pending";
          schedule.scheduledAt = Date.now() + 30000;
          await this.updateSchedule(scheduleId, schedule);
          this.startProcessingSchedule(scheduleId);
        }
      }
    } catch (error) {
      console.error(`Error processing schedule ${scheduleId}:`, error);

      const schedule = this.processingQueue.get(scheduleId);
      if (schedule) {
        schedule.status = "failed";
        this.processingQueue.set(scheduleId, schedule);
        await this.cleanupSchedule(scheduleId);
      }
    }
  }

  private async executeComment(schedule: CommentSchedule): Promise<boolean> {
    try {
      const commentData = {
        postId: schedule.postId,
        platform: schedule.platform,
        commentType: schedule.commentType,
        content: schedule.content,
        scheduledAt: schedule.scheduledAt,
        delay: schedule.delay,
      };

      const response = await fetch(
        `${process.env.SUPABASE_FUNCTIONS_URL}/comment-processor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(commentData),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: { success?: boolean } = await response.json();
      return result.success || false;
    } catch (error) {
      console.error("Error executing comment:", error);
      return false;
    }
  }

  async getSchedule(scheduleId: string): Promise<CommentSchedule | null> {
    try {
      const cached = await this.redis.get(`schedule:${scheduleId}`);
      if (cached) {
        return JSON.parse(cached as string);
      }

      return null;
    } catch (error) {
      console.error("Error getting schedule:", error);
      return null;
    }
  }

  async getPendingSchedules(limit: number = 10): Promise<CommentSchedule[]> {
    try {
      const scheduleIds = await this.redis.zrange(
        "schedules:pending",
        0,
        limit - 1,
      );
      const schedules: CommentSchedule[] = [];

      for (const scheduleId of scheduleIds as string[]) {
        const schedule = await this.getSchedule(scheduleId);
        if (schedule && schedule.status === "pending") {
          schedules.push(schedule);
        }
      }

      return schedules;
    } catch (error) {
      console.error("Error getting pending schedules:", error);
      return [];
    }
  }

  async getProcessingSchedules(limit: number = 10): Promise<CommentSchedule[]> {
    try {
      const schedules: CommentSchedule[] = [];

      for (const [scheduleId, schedule] of this.processingQueue.entries()) {
        if (schedule.status === "processing") {
          schedules.push(schedule);
        }
      }

      return schedules.slice(0, limit);
    } catch (error) {
      console.error("Error getting processing schedules:", error);
      return [];
    }
  }

  async updateSchedule(
    scheduleId: string,
    updates: Partial<CommentSchedule>,
  ): Promise<void> {
    try {
      const schedule = await this.getSchedule(scheduleId);
      if (!schedule) return;

      const updatedSchedule = {
        ...schedule,
        ...updates,
        updatedAt: Date.now(),
      };

      await this.redis.setex(
        `schedule:${scheduleId}`,
        86400,
        JSON.stringify(updatedSchedule),
      );

      if (updates.status === "completed" || updates.status === "failed") {
        await this.redis.zrem("schedules:pending", scheduleId);
        this.processingQueue.delete(scheduleId);
      } else {
        await this.redis.zadd("schedules:pending", {
          score: updatedSchedule.scheduledAt,
          member: scheduleId,
        });
        this.processingQueue.set(scheduleId, updatedSchedule);
      }
    } catch (error) {
      console.error("Error updating schedule:", error);
    }
  }

  private async cleanupSchedule(scheduleId: string): Promise<void> {
    try {
      await this.redis.del(`schedule:${scheduleId}`);
      await this.redis.zrem("schedules:pending", scheduleId);
      this.processingQueue.delete(scheduleId);
    } catch (error) {
      console.error("Error cleaning up schedule:", error);
    }
  }

  async getScheduleStats(): Promise<any> {
    try {
      const pendingCount = await this.redis.zcard("schedules:pending");
      const processingCount = this.processingQueue.size;

      const platformStats: Record<string, number> = {};
      const statusStats: Record<string, number> = {};

      const allSchedules = await this.redis.keys("schedule:*");
      for (const key of allSchedules.slice(0, 100)) {
        const schedule = await this.redis.get(key);
        if (schedule) {
          const parsed = JSON.parse(schedule as string);
          platformStats[parsed.platform] =
            (platformStats[parsed.platform] || 0) + 1;
          statusStats[parsed.status] = (statusStats[parsed.status] || 0) + 1;
        }
      }

      return {
        totalSchedules: allSchedules.length,
        pendingCount,
        processingCount,
        platformStats,
        statusStats,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error("Error getting schedule stats:", error);
      return null;
    }
  }

  async cleanupOldSchedules(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [scheduleId, schedule] of this.processingQueue.entries()) {
        if (now - schedule.createdAt > olderThan) {
          keysToDelete.push(scheduleId);
        }
      }

      for (const scheduleId of keysToDelete) {
        await this.cleanupSchedule(scheduleId);
      }
    } catch (error) {
      console.error("Error cleaning up old schedules:", error);
    }
  }

  async processBatchComments(batchSize: number = 5): Promise<void> {
    try {
      const pendingSchedules = await this.getPendingSchedules(batchSize);

      for (const schedule of pendingSchedules) {
        await this.processSchedule(schedule.id);
      }
    } catch (error) {
      console.error("Error processing batch comments:", error);
    }
  }

  async getJitterConfig(platform: "x" | "facebook"): Promise<JitterConfig> {
    return this.antiSpamConfig[platform];
  }

  async updateJitterConfig(
    platform: "x" | "facebook",
    config: Partial<JitterConfig>,
  ): Promise<void> {
    this.antiSpamConfig[platform] = {
      ...this.antiSpamConfig[platform],
      ...config,
    };
  }
}

export { SmartCommentScheduler };
export type { CommentSchedule, JitterConfig, AntiSpamConfig };
