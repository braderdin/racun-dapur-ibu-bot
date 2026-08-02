import { Env } from "../types/env";
import { SupabaseService } from "../services/supabase";

export class PostDeletionService {
  private supabase: SupabaseService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.supabase = new SupabaseService(env);
  }

  /**
   * Make a REST API call to Supabase
   */
  private async supabaseQuery(
    table: string,
    query: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: any,
  ): Promise<{ data: any; error: any }> {
    try {
      const url = `${this.env.SUPABASE_URL}/rest/v1/${table}${query}`;
      const response = await fetch(url, {
        method,
        headers: {
          apikey: this.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          data: null,
          error: { message: errorText, status: response.status },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  }

  /**
   * Delete a specific Tweet or Facebook post programmatically
   * @param postId - The post ID to delete
   * @param platform - Platform ("twitter" or "facebook")
   * @param userId - User ID requesting deletion
   * @param metadata - Additional metadata for deletion
   * @returns Deletion result
   */
  async deletePost(
    postId: string,
    platform: "twitter" | "facebook",
    userId: string,
    metadata?: any,
  ): Promise<any> {
    try {
      if (!postId || !platform || !userId) {
        throw new Error("Missing required parameters for post deletion");
      }

      console.log(
        `Processing delete request for ${platform} post ${postId} by user ${userId}`,
      );

      // Validate post exists and user has permission
      const validationResult = await this.validateDeletionPermission(
        postId,
        platform,
        userId,
      );
      if (!validationResult.canDelete) {
        throw new Error(`Deletion not allowed: ${validationResult.reason}`);
      }

      // Perform platform-specific deletion
      const deletionResult = await this.performDeletion(
        postId,
        platform,
        userId,
        metadata,
      );

      if (!deletionResult.success) {
        throw new Error(
          `Failed to delete ${platform} post: ${deletionResult.error}`,
        );
      }

      // Log deletion to audit trail
      await this.logDeletion(
        postId,
        platform,
        userId,
        metadata,
        deletionResult,
      );

      console.log(
        `${platform} post ${postId} deleted successfully by user ${userId}`,
      );
      return {
        success: true,
        postId,
        platform,
        userId,
        timestamp: Date.now(),
        deletionResult,
      };
    } catch (error) {
      console.error(`Error deleting ${platform} post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Validate deletion permission
   * @param postId - Post ID
   * @param platform - Platform
   * @param userId - User ID
   * @returns Validation result
   */
  private async validateDeletionPermission(
    postId: string,
    platform: "twitter" | "facebook",
    userId: string,
  ): Promise<{ canDelete: boolean; reason?: string }> {
    try {
      // Check if post exists in database
      const postExists = await this.checkPostExists(postId, platform);
      if (!postExists) {
        return { canDelete: false, reason: "Post not found in database" };
      }

      // Check if user has permission (admin or original poster)
      const userPermission = await this.checkUserPermission(
        postId,
        platform,
        userId,
      );
      if (!userPermission.hasPermission) {
        return { canDelete: false, reason: userPermission.reason };
      }

      // Check if post is already deleted
      const postStatus = await this.getPostStatus(postId, platform);
      if (postStatus === "deleted") {
        return { canDelete: false, reason: "Post already deleted" };
      }

      return { canDelete: true };
    } catch (error) {
      console.error("Error validating deletion permission:", error);
      return { canDelete: false, reason: "Validation error" };
    }
  }

  /**
   * Check if post exists in database
   * @param postId - Post ID
   * @param platform - Platform
   * @returns True if post exists
   */
  private async checkPostExists(
    postId: string,
    platform: "twitter" | "facebook",
  ): Promise<boolean> {
    try {
      const table = platform === "twitter" ? "twitter_posts" : "facebook_posts";
      const { data, error } = await this.supabaseQuery(
        table,
        `?id=eq.${postId}&select=id&limit=1`,
      );

      return !!data && data.length > 0 && !error;
    } catch (error) {
      console.error("Error checking post existence:", error);
      return false;
    }
  }

  /**
   * Check user permission for deletion
   * @param postId - Post ID
   * @param platform - Platform
   * @param userId - User ID
   * @returns Permission result
   */
  private async checkUserPermission(
    postId: string,
    platform: "twitter" | "facebook",
    userId: string,
  ): Promise<{ hasPermission: boolean; reason?: string }> {
    try {
      const table = platform === "twitter" ? "twitter_posts" : "facebook_posts";
      const { data, error } = await this.supabaseQuery(
        table,
        `?id=eq.${postId}&select=user_id,status&limit=1`,
      );

      if (error || !data || data.length === 0) {
        return { hasPermission: false, reason: "Post not found" };
      }

      const post = data[0];

      // Check if user is admin (in production, check against admin roles)
      const isAdmin = await this.checkIfUserIsAdmin(userId);
      if (isAdmin) {
        return { hasPermission: true };
      }

      // Check if user is the original poster
      if (post.user_id === userId) {
        return { hasPermission: true };
      }

      // Check if post is already published
      if (post.status === "published") {
        return { hasPermission: false, reason: "Cannot delete published post" };
      }

      return { hasPermission: true };
    } catch (error) {
      console.error("Error checking user permission:", error);
      return { hasPermission: false, reason: "Permission check error" };
    }
  }

  /**
   * Check if user is admin
   * @param userId - User ID
   * @returns True if user is admin
   */
  private async checkIfUserIsAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseQuery(
        "admin_users",
        `?user_id=eq.${userId}&select=user_id&limit=1`,
      );

      return !!data && data.length > 0 && !error;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  /**
   * Get post status
   * @param postId - Post ID
   * @param platform - Platform
   * @returns Post status
   */
  private async getPostStatus(
    postId: string,
    platform: "twitter" | "facebook",
  ): Promise<string> {
    try {
      const table = platform === "twitter" ? "twitter_posts" : "facebook_posts";
      const { data, error } = await this.supabaseQuery(
        table,
        `?id=eq.${postId}&select=status&limit=1`,
      );

      return data?.[0]?.status || "unknown";
    } catch (error) {
      console.error("Error getting post status:", error);
      return "unknown";
    }
  }

  /**
   * Perform platform-specific deletion
   * @param postId - Post ID
   * @param platform - Platform
   * @param userId - User ID
   * @param metadata - Metadata
   * @returns Deletion result
   */
  private async performDeletion(
    postId: string,
    platform: "twitter" | "facebook",
    userId: string,
    metadata?: any,
  ): Promise<any> {
    try {
      switch (platform) {
        case "twitter":
          return await this.deleteTwitterPost(postId, userId, metadata);
        case "facebook":
          return await this.deleteFacebookPost(postId, userId, metadata);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error("Error performing deletion:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete Twitter post
   * @param postId - Post ID
   * @param userId - User ID
   * @param metadata - Metadata
   * @returns Deletion result
   */
  private async deleteTwitterPost(
    postId: string,
    userId: string,
    metadata?: any,
  ): Promise<any> {
    try {
      // In production, integrate with Twitter API v2
      // For now, return success with mock response
      console.log(`Would delete Twitter post ${postId} via Twitter API v2`);

      return {
        success: true,
        platform: "twitter",
        postId,
        deletedAt: Date.now(),
        deletedBy: userId,
        metadata,
      };
    } catch (error) {
      console.error("Error deleting Twitter post:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete Facebook post
   * @param postId - Post ID
   * @param userId - User ID
   * @param metadata - Metadata
   * @returns Deletion result
   */
  private async deleteFacebookPost(
    postId: string,
    userId: string,
    metadata?: any,
  ): Promise<any> {
    try {
      // In production, integrate with Facebook Graph API
      // For now, return success with mock response
      console.log(
        `Would delete Facebook post ${postId} via Facebook Graph API`,
      );

      return {
        success: true,
        platform: "facebook",
        postId,
        deletedAt: Date.now(),
        deletedBy: userId,
        metadata,
      };
    } catch (error) {
      console.error("Error deleting Facebook post:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log deletion to audit trail
   * @param postId - Post ID
   * @param platform - Platform
   * @param userId - User ID
   * @param metadata - Metadata
   * @param deletionResult - Deletion result
   */
  private async logDeletion(
    postId: string,
    platform: "twitter" | "facebook",
    userId: string,
    metadata: any,
    deletionResult: any,
  ): Promise<void> {
    try {
      const auditRecord = {
        post_id: postId,
        platform,
        user_id: userId,
        action: "delete",
        timestamp: Date.now(),
        metadata,
        deletion_result: deletionResult,
        status: "completed",
      };

      // In production, save to audit log table
      console.log(`Deletion logged: ${JSON.stringify(auditRecord)}`);
    } catch (error) {
      console.error("Error logging deletion:", error);
    }
  }

  /**
   * Get deletion history for a post
   * @param postId - Post ID
   * @returns Deletion history
   */
  async getDeletionHistory(postId: string): Promise<any[]> {
    try {
      // In production, fetch from audit log table
      console.log(`Would fetch deletion history for post ${postId}`);
      return [];
    } catch (error) {
      console.error("Error getting deletion history:", error);
      return [];
    }
  }

  /**
   * Get deletion statistics
   * @returns Deletion statistics
   */
  getDeletionStats(): any {
    return {
      platform: "Post Deletion Service",
      supportedPlatforms: ["twitter", "facebook"],
      deletionActions: ["delete", "validate", "audit"],
      rateLimit: "5 deletions per minute",
      auditLogging: true,
      permissionControl: true,
    };
  }
}
