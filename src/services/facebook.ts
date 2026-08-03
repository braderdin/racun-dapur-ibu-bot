import { Env } from "../types/env";
import { logger } from "../utils/logger";
import { delay } from "../utils/delay";

// Facebook Graph API Response Schemas with Zod
import { z } from "zod";

// Re-export important types from product.ts
export interface FacebookPostPayload {
  message: string;
  url?: string;
  picture?: string;
  link?: string;
}

export interface FacebookCommentPayload {
  message: string;
  parent_comment_id?: string;
}

export interface DualPostResult {
  twitterPostId?: string;
  facebookPostId?: string;
  facebookCommentId?: string;
  twitterStatus: "published" | "failed" | "pending";
  facebookStatus: "published" | "failed" | "pending";
  error?: string;
}

// Facebook API Response Interface
export interface FacebookPostResponse {
  id: string;
  success: boolean;
  postId?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// Zod validation schemas
const FacebookPostResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  postId: z.string().optional(),
  error: z
    .object({
      message: z.string(),
      type: z.string(),
      code: z.number(),
    })
    .optional(),
});

const FacebookCommentResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  error: z
    .object({
      message: z.string(),
      type: z.string(),
      code: z.number(),
    })
    .optional(),
});

export class FacebookService {
  private env: Env;
  private readonly graphApiBaseUrl = "https://graph.facebook.com/v19.0";
  private readonly timeoutMs = 15000;

  constructor(env?: Env) {
    this.env = env || ({} as Env);
    logger.info(
      "Facebook Service initialized",
      {
        hasAccessToken: !!env?.FACEBOOK_PAGE_ACCESS_TOKEN,
      },
      "FacebookService",
    );
  }

  // Main method to post to Facebook Page
  async postToFacebookPage(
    postData: FacebookPostPayload,
  ): Promise<FacebookPostResponse> {
    try {
      // Rate limiting with 3-second delay wrapper
      await delay(3000);

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // Prepare form data for Facebook Graph API
      const formData = new URLSearchParams();
      formData.append("message", postData.message);

      if (postData.url) formData.append("url", postData.url);
      if (postData.picture) formData.append("picture", postData.picture);
      if (postData.link) formData.append("link", postData.link);

      const response = await fetch(
        `${this.graphApiBaseUrl}/${this.env.FACEBOOK_PAGE_ID}/feed`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
          },
          body: formData.toString(),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string; type?: string; code?: number };
        } | null;
        const error = {
          message:
            errorData?.error?.message ||
            `Facebook API error: ${response.status} ${response.statusText}`,
          type: errorData?.error?.type || "API_ERROR",
          code: errorData?.error?.code || response.status,
        };

        logger.error(
          "Facebook page post failed",
          {
            status: response.status,
            error: error.message,
            elapsed,
          },
          "FacebookService",
        );

        return {
          id: "",
          success: false,
          postId: undefined,
          error,
        };
      }

      const data: { id?: string } = await response.json();

      // Validate response with Zod
      const validatedResponse = FacebookPostResponseSchema.parse({
        id: data.id || `post_${Date.now()}`,
        success: true,
        postId: data.id,
      });

      logger.info(
        "Facebook page post successful",
        {
          postId: data.id,
          messageId: data.id,
          elapsed,
        },
        "FacebookService",
      );

      return validatedResponse;
    } catch (error) {
      logger.error(
        "Unexpected error posting to Facebook page",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "FacebookService",
      );

      return {
        id: "",
        success: false,
        error:
          error instanceof Error
            ? {
                message: error.message,
                type: "NETWORK_ERROR",
                code: 500,
              }
            : {
                message: "Unknown error occurred",
                type: "UNKNOWN_ERROR",
                code: 500,
              },
      };
    }
  }

  /**
   * Post to Facebook Page with media (alias for postToFacebookPage)
   * @param message - Post message
   * @param imageUrl - Image URL
   * @returns Post result
   */
  async postToPageWithMedia(
    message: string,
    imageUrl: string,
  ): Promise<FacebookPostResponse> {
    return this.postToFacebookPage({
      message,
      picture: imageUrl,
    });
  }

  /**
   * Post comment to Facebook post (alias for postCommentToFacebook)
   * @param postId - Post ID
   * @param commentText - Comment text
   * @returns Comment result
   */
  async postComment(
    postId: string,
    commentText: string,
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    const result = await this.postCommentToFacebook(postId, {
      message: commentText,
    });
    return {
      success: result.success,
      commentId: result.id,
      error: result.error?.message,
    };
  }

  // Post comment to Facebook post
  async postCommentToFacebook(
    postId: string,
    commentData: FacebookCommentPayload,
  ): Promise<any> {
    try {
      // Rate limiting with 3-second delay wrapper
      await delay(3000);

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `${this.graphApiBaseUrl}/${postId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
          },
          body: JSON.stringify(commentData),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string; type?: string; code?: number };
        } | null;
        const error = {
          message:
            errorData?.error?.message ||
            `Facebook API error: ${response.status} ${response.statusText}`,
          type: errorData?.error?.type || "API_ERROR",
          code: errorData?.error?.code || response.status,
        };

        logger.error(
          "Facebook comment posting failed",
          {
            status: response.status,
            error: error.message,
            elapsed,
            postId,
          },
          "FacebookService",
        );

        return {
          id: "",
          success: false,
          error,
        };
      }

      const data: { id?: string } = await response.json();

      // Validate response with Zod
      const validatedResponse = FacebookCommentResponseSchema.parse({
        id: data.id || `comment_${Date.now()}`,
        success: true,
      });

      logger.info(
        "Facebook comment posted successfully",
        {
          commentId: data.id,
          postId,
          elapsed,
        },
        "FacebookService",
      );

      return validatedResponse;
    } catch (error) {
      logger.error(
        "Unexpected error posting comment to Facebook",
        {
          error: error instanceof Error ? error.message : String(error),
          postId,
        },
        "FacebookService",
      );

      return {
        id: "",
        success: false,
        error:
          error instanceof Error
            ? {
                message: error.message,
                type: "NETWORK_ERROR",
                code: 500,
              }
            : {
                message: "Unknown error occurred",
                type: "UNKNOWN_ERROR",
                code: 500,
              },
      };
    }
  }

  // Get Facebook Page Access Token
  async getFacebookPageAccessToken(): Promise<string> {
    try {
      logger.info("Fetching Facebook Page Access Token", {}, "FacebookService");

      await delay(3000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.env.FACEBOOK_APP_ID || "",
            client_secret: this.env.FACEBOOK_APP_SECRET || "",
          }).toString(),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string; type?: string; code?: number };
        } | null;
        const error = {
          message:
            errorData?.error?.message ||
            `Facebook OAuth error: ${response.status} ${response.statusText}`,
          type: errorData?.error?.type || "OAUTH_ERROR",
          code: errorData?.error?.code || response.status,
        };

        logger.error(
          "Failed to get Facebook Page Access Token",
          {
            status: response.status,
            error: error.message,
          },
          "FacebookService",
        );

        throw new Error(`Failed to get access token: ${error.message}`);
      }

      const data: { access_token?: string } = await response.json();

      logger.info(
        "Successfully fetched Facebook Page Access Token",
        {
          tokenLength: data.access_token?.length || 0,
        },
        "FacebookService",
      );

      return data.access_token || "";
    } catch (error) {
      logger.error(
        "Unexpected error getting Facebook Page Access Token",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "FacebookService",
      );

      throw error instanceof Error
        ? error
        : new Error("Unknown error occurred");
    }
  }

  // Validate Facebook credentials
  async validateFacebookCredentials(): Promise<boolean> {
    try {
      logger.info("Validating Facebook credentials", {}, "FacebookService");

      await delay(3000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.graphApiBaseUrl}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isValid = response.ok;

      if (isValid) {
        const data: { id?: string; name?: string } = await response.json();
        logger.info(
          "Facebook credentials validated successfully",
          {
            userId: data.id,
            name: data.name,
          },
          "FacebookService",
        );
      } else {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const errorMessage =
          errorData?.error?.message ||
          `Facebook validation failed: ${response.status} ${response.statusText}`;

        logger.warn(
          "Facebook credentials validation failed",
          {
            status: response.status,
            error: errorMessage,
          },
          "FacebookService",
        );
      }

      return isValid;
    } catch (error) {
      logger.error(
        "Unexpected error validating Facebook credentials",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "FacebookService",
      );

      return false;
    }
  }

  // Post photo with story to Facebook Page
  async publishPhotoWithStory(
    productId: string,
    platform: string,
    title: string,
    description: string,
    price: number,
    imageUrl: string,
    category: string,
    rating: number,
    affiliateLink: string,
    expirationDate: string,
    accessToken: string,
    pageId: string,
  ): Promise<FacebookPostResponse> {
    try {
      await delay(3000);

      const message = `${title}\n\n${description}\n\nPrice: $${price}\nRating: ${rating}/5\nCategory: ${category}\nExpires: ${expirationDate}\n\n${affiliateLink}`;

      const formData = new URLSearchParams();
      formData.append("message", message);
      if (imageUrl) formData.append("url", imageUrl);
      formData.append("link", affiliateLink);

      const response = await fetch(`${this.graphApiBaseUrl}/${pageId}/feed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        return {
          id: "",
          success: false,
          error: {
            message: errorData?.error?.message || "Failed to post to Facebook",
            type: "API_ERROR",
            code: response.status,
          },
        };
      }

      const data: { id?: string } = await response.json();
      return {
        id: data.id || "",
        success: true,
        postId: data.id,
      };
    } catch (error) {
      return {
        id: "",
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          type: "NETWORK_ERROR",
          code: 0,
        },
      };
    }
  }

  // Add affiliate comment to Facebook post
  async addAffiliateComment(
    postId: string,
    comment: string,
    accessToken: string,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      await delay(3000);

      const response = await fetch(
        `${this.graphApiBaseUrl}/${postId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: comment }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        return {
          success: false,
          error: errorData?.error?.message || "Failed to add comment",
        };
      }

      const data: { id?: string } = await response.json();
      return { success: true, id: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Health check for Facebook service
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy" | "degraded";
    details: string;
    timestamp: string;
  }> {
    try {
      // Test basic connectivity
      await delay(3000);

      const isCredentialsValid = await this.validateFacebookCredentials();

      if (isCredentialsValid) {
        const accessToken = await this.getFacebookPageAccessToken();
        // Verify token works with a simple API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.graphApiBaseUrl}/me/accounts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          logger.info(
            "Facebook service health check passed",
            {},
            "FacebookService",
          );
          return {
            status: "healthy",
            details: "Facebook Graph API is operational",
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(`Health check failed: ${response.status}`);
        }
      } else {
        throw new Error("Facebook credentials validation failed");
      }
    } catch (error) {
      logger.error(
        "Facebook service health check failed",
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "FacebookService",
      );

      return {
        status: "unhealthy",
        details: `Facebook service error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Factory function to create FacebookService instance
export function createFacebookService(env: Env): FacebookService {
  return new FacebookService(env);
}
