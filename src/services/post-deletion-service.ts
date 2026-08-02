// Emergency Post Deletion Service
// API wrapper service that calls Twitter API v2 delete endpoint and Facebook Graph API delete endpoint when triggered by Telegram emergency actions

import { Redis } from "@upstash/redis";

interface PostDeletionRequest {
  id: string;
  platform: "x" | "facebook";
  postId: string;
  userId: string;
  reason: string;
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
  metadata: {
    originalContent?: string;
    generatedCopy?: string;
    apiResponse?: any;
    error?: string;
    source?: string;
    action?: string;
    userId?: string;
  };
  createdAt: number;
  updatedAt: number;
}

interface DeletionResult {
  success: boolean;
  platform: "x" | "facebook";
  postId: string;
  deletedAt: number;
  apiResponse?: any;
  error?: string;
}

interface XAPIDeleteResponse {
  data: {
    deleted: boolean;
    id: string;
    media_id?: string;
    title?: string;
  };
}

interface FacebookAPIDeleteResponse {
  success: boolean;
  id: string;
}

class PostDeletionService {
  private redis: Redis;
  private xApiToken: string;
  private facebookApiToken: string;
  private facebookPageId: string;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.xApiToken = process.env.X_API_BEARER_TOKEN || "";
    this.facebookApiToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
    this.facebookPageId = process.env.FACEBOOK_PAGE_ID || "";
  }

  async deletePost(request: PostDeletionRequest): Promise<DeletionResult> {
    try {
      const deletionId = `deletion:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

      const deletionRequest: PostDeletionRequest = {
        id: deletionId,
        platform: request.platform,
        postId: request.postId,
        userId: request.userId,
        reason: request.reason,
        timestamp: Date.now(),
        status: "processing",
        metadata: {
          originalContent: request.metadata?.originalContent,
          generatedCopy: request.metadata?.generatedCopy,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.cacheDeletionRequest(deletionId, deletionRequest);

      const result = await this.executeDeletion(deletionRequest);

      deletionRequest.status = result.success ? "completed" : "failed";
      deletionRequest.metadata.apiResponse = result.apiResponse;
      if (!result.success) {
        deletionRequest.metadata.error = result.error;
      }
      deletionRequest.updatedAt = Date.now();

      await this.updateDeletionRequest(deletionId, deletionRequest);

      await this.logDeletion(deletionRequest);

      return result;
    } catch (error) {
      console.error("Error deleting post:", error);
      return {
        success: false,
        platform: request.platform,
        postId: request.postId,
        deletedAt: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeDeletion(
    request: PostDeletionRequest,
  ): Promise<DeletionResult> {
    switch (request.platform) {
      case "x":
        return await this.deleteXPost(request);
      case "facebook":
        return await this.deleteFacebookPost(request);
      default:
        throw new Error(`Unsupported platform: ${request.platform}`);
    }
  }

  private async deleteXPost(
    request: PostDeletionRequest,
  ): Promise<DeletionResult> {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${request.postId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.xApiToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `X API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result: XAPIDeleteResponse = await response.json();

      return {
        success: result.data?.deleted || false,
        platform: "x",
        postId: request.postId,
        deletedAt: Date.now(),
        apiResponse: result,
      };
    } catch (error) {
      console.error("Error deleting X post:", error);
      return {
        success: false,
        platform: "x",
        postId: request.postId,
        deletedAt: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async deleteFacebookPost(
    request: PostDeletionRequest,
  ): Promise<DeletionResult> {
    try {
      const response = await fetch(
        `${process.env.META_GRAPH_API_URL}/${request.postId}?access_token=${this.facebookApiToken}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Facebook Graph API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result: FacebookAPIDeleteResponse = await response.json();

      return {
        success: result.success || false,
        platform: "facebook",
        postId: request.postId,
        deletedAt: Date.now(),
        apiResponse: result,
      };
    } catch (error) {
      console.error("Error deleting Facebook post:", error);
      return {
        success: false,
        platform: "facebook",
        postId: request.postId,
        deletedAt: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getDeletionRequest(
    deletionId: string,
  ): Promise<PostDeletionRequest | null> {
    try {
      const cached = await this.redis.get(`deletion:${deletionId}`);
      if (cached) {
        return JSON.parse(cached as string);
      }
      return null;
    } catch (error) {
      console.error("Error getting deletion request:", error);
      return null;
    }
  }

  async getDeletionHistory(
    userId: string,
    limit: number = 10,
  ): Promise<PostDeletionRequest[]> {
    try {
      const keys = await this.redis.keys("deletion:*");
      const deletions: PostDeletionRequest[] = [];

      for (const key of keys.slice(0, 100)) {
        const deletion = await this.redis.get(key);
        if (deletion) {
          const parsed = JSON.parse(deletion as string);
          if (parsed.userId === userId) {
            deletions.push(parsed);
          }
        }
      }

      deletions.sort((a, b) => b.timestamp - a.timestamp);
      return deletions.slice(0, limit);
    } catch (error) {
      console.error("Error getting deletion history:", error);
      return [];
    }
  }

  async getAllDeletions(limit: number = 10): Promise<PostDeletionRequest[]> {
    try {
      const keys = await this.redis.keys("deletion:*");
      const deletions: PostDeletionRequest[] = [];

      for (const key of keys.slice(0, 100)) {
        const deletion = await this.redis.get(key);
        if (deletion) {
          deletions.push(JSON.parse(deletion as string));
        }
      }

      deletions.sort((a, b) => b.timestamp - a.timestamp);
      return deletions.slice(0, limit);
    } catch (error) {
      console.error("Error getting all deletions:", error);
      return [];
    }
  }

  private async cacheDeletionRequest(
    deletionId: string,
    request: PostDeletionRequest,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `deletion:${deletionId}`,
        86400,
        JSON.stringify(request),
      );
    } catch (error) {
      console.error("Error caching deletion request:", error);
    }
  }

  private async updateDeletionRequest(
    deletionId: string,
    request: PostDeletionRequest,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `deletion:${deletionId}`,
        86400,
        JSON.stringify(request),
      );
    } catch (error) {
      console.error("Error updating deletion request:", error);
    }
  }

  private async logDeletion(request: PostDeletionRequest): Promise<void> {
    try {
      const logEntry = {
        deletionId: request.id,
        userId: request.userId,
        platform: request.platform,
        postId: request.postId,
        reason: request.reason,
        timestamp: request.timestamp,
        status: request.status,
        success: request.status === "completed",
      };

      await this.redis.lpush("deletion_log", JSON.stringify(logEntry));
      await this.redis.expire("deletion_log", 86400);
    } catch (error) {
      console.error("Error logging deletion:", error);
    }
  }

  async getDeletionStats(): Promise<any> {
    try {
      const keys = await this.redis.keys("deletion:*");
      const stats: any = {
        totalDeletions: keys.length,
        byPlatform: { x: 0, facebook: 0 },
        byStatus: { pending: 0, processing: 0, completed: 0, failed: 0 },
        successRate: 0,
        lastUpdated: Date.now(),
      };

      let successfulDeletions = 0;

      for (const key of keys.slice(0, 100)) {
        const deletion = await this.redis.get(key);
        if (deletion) {
          const parsed = JSON.parse(deletion as string);
          stats.byPlatform[parsed.platform] =
            (stats.byPlatform[parsed.platform] || 0) + 1;
          stats.byStatus[parsed.status] =
            (stats.byStatus[parsed.status] || 0) + 1;

          if (parsed.status === "completed") {
            successfulDeletions++;
          }
        }
      }

      stats.successRate =
        stats.totalDeletions > 0
          ? (successfulDeletions / stats.totalDeletions) * 100
          : 0;

      return stats;
    } catch (error) {
      console.error("Error getting deletion stats:", error);
      return null;
    }
  }

  async cleanupOldDeletions(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const key of await this.redis.keys("deletion:*")) {
        const deletion = await this.redis.get(key);
        if (deletion) {
          const parsed = JSON.parse(deletion as string);
          if (now - parsed.timestamp > olderThan) {
            keysToDelete.push(key);
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old deletions:", error);
    }
  }

  async validateDeletionPermission(
    userId: string,
    postId: string,
    platform: "x" | "facebook",
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const postInfo = await this.getPostInfo(postId);
      if (!postInfo) {
        return { isValid: false, reason: "Post not found" };
      }

      if (postInfo.platform !== platform) {
        return { isValid: false, reason: "Platform mismatch" };
      }

      const userRole = await this.getUserRole(userId);
      if (!["admin", "moderator", "owner"].includes(userRole)) {
        return { isValid: false, reason: "Insufficient permissions" };
      }

      return { isValid: true };
    } catch (error) {
      console.error("Error validating deletion permission:", error);
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : "Validation error",
      };
    }
  }

  private async getPostInfo(postId: string): Promise<any | null> {
    try {
      const cacheKey = `post:${postId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
      return null;
    } catch (error) {
      console.error("Error getting post info:", error);
      return null;
    }
  }

  private async getUserRole(userId: string): Promise<string> {
    try {
      const cacheKey = `user_role:${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached as string;
      }
      return "user";
    } catch (error) {
      console.error("Error getting user role:", error);
      return "user";
    }
  }

  async emergencyDeleteAllPosts(
    userId: string,
    reason: string,
  ): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let deletedCount = 0;

      const userDeletions = await this.getDeletionHistory(userId);
      for (const deletion of userDeletions) {
        if (deletion.status === "completed") {
          continue;
        }

        const result = await this.deletePost(deletion);
        if (result.success) {
          deletedCount++;
        } else {
          errors.push(
            `${deletion.platform} post ${deletion.postId}: ${result.error}`,
          );
        }
      }

      return {
        success: errors.length === 0,
        deletedCount,
        errors,
      };
    } catch (error) {
      console.error("Error in emergency delete all posts:", error);
      return {
        success: false,
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }
}

export { PostDeletionService };
export type { PostDeletionRequest, DeletionResult };
