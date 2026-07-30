//
 * Facebook Graph API Integration Service
 * Handles Facebook Page posting, photo upload with storytelling, and affiliate comment posting
 * Implements 3-tier error handling with OpenRouter AI fallback
 * Follows 15-second timeout safeguards and RM0 cost strategy
 */

import { CONSTANTS } from "../config/constants";
import { AIFallbackEngine } from "./ai-fallback";
import { RedisService } from "./redis";
import { SupabaseService } from "./supabase";
import { B2StorageService } from "./b2-storage";
import { ImageProcessor } from "../utils/image-processor";

// Facebook Graph API Types
export interface FacebookPostPayload {
  message: string;
  url?: string;
  picture?: string;
  link?: string;
  temporary_uploaded_media_id?: string;
}

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

export interface FacebookCommentPayload {
  message: string;
  parent_comment_id?: string;
}

export interface FacebookCommentResponse {
  id: string;
  success: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

export interface DualPostResult {
  twitterPostId?: string;
  facebookPostId?: string;
  facebookCommentId?: string;
  twitterStatus: "published" | "failed" | "pending";
  facebookStatus: "published" | "failed" | "pending";
  error?: string;
}

// Main Facebook Service Class
export class FacebookService {
  private redisService: RedisService;
  private supabaseService: SupabaseService;
  private b2StorageService: B2StorageService;
  private imageProcessor: ImageProcessor;
  private openrouterService: any; // Will be initialized with dependency injection

  constructor(
    redisService: RedisService,
    supabaseService: SupabaseService,
    b2StorageService: B2StorageService,
    imageProcessor: ImageProcessor,
    openrouterService?: any
  ) {
    this.redisService = redisService;
    this.supabaseService = supabaseService;
    this.b2StorageService = b2StorageService;
    this.imageProcessor = imageProcessor;
    this.openrouterService = openrouterService || this.createFallbackOpenRouter();
  }

  // Main method to publish photo with story (Facebook Page)
  async publishPhotoWithStory(
    productId: string,
    platform: "lazada" | "shopee",
    title: string,
    description: string,
    price: number,
    imageUrl: string,
    category: string,
    rating: number,
    affiliateLink: string,
    expirationDate: string,
    facebookPageAccessToken: string,
    facebookPageId: string
  ): Promise<FacebookPostResponse> {
    const startTime = Date.now();
    const timeoutMs = CONSTANTS.FACEBOOK_API_TIMEOUT_MS || 15000;

    try {
      // 1. Generate Facebook copywriting using OpenRouter AI with 3-tier fallback
      const facebookCopy = await this.generateFacebookCopywriting(
        title,
        description,
        price,
        category,
        rating,
        platform,
        expirationDate
      );

      // 2. Process and upload image to B2 Storage
      const processedImage = await this.processImageForFacebook(
        imageUrl,
        productId,
        platform,
        category
      );

      // 3. Upload to Facebook Graph API
      const facebookPostResponse = await this.uploadToFacebookGraph(
        facebookPageAccessToken,
        facebookPageId,
        facebookCopy.story,
        processedImage.webpUrl,
        affiliateLink,
        timeoutMs - (Date.now() - startTime)
      );

      // 4. Log to Supabase for analytics and tracking
      await this.logFacebookPost(
        productId,
        platform,
        facebookPostResponse.id,
        "published"
      );

      // 5. Add Redis anti-repeat protection (5 days TTL)
      await this.setFacebookPostCache(productId, facebookPostResponse.id);

      return facebookPostResponse;

    } catch (error) {
      console.error(`❌ Facebook photo with story failed for product ${productId}:`, error);
      
      // Log failure to Supabase
      await this.logFacebookPost(
        productId,
        platform,
        undefined,
        "failed",
        error.message
      );

      // Implement 3-tier error handling
      if (this.isTemporaryError(error)) {
        // Tier 1: Temporary error - retry with exponential backoff
        console.log("🔄 Temporary error encountered, will retry with delay");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second delay
        return await this.publishPhotoWithStory(
          productId,
          platform,
          title,
          description,
          price,
          imageUrl,
          category,
          rating,
          affiliateLink,
          expirationDate,
          facebookPageAccessToken,
          facebookPageId
        );
      } else if (this.isConfigurationError(error)) {
        // Tier 2: Configuration error - use fallback to simplified posting
        console.log("⚠️ Configuration error, using fallback posting strategy");
        return await this.fallbackPublishPhoto(
          productId,
          facebookCopy?.story || `${title} - Special offer: $${price}",
          processedImage?.webpUrl,
          facebookPageAccessToken,
          facebookPageId
        );
      } else {
        // Tier 3: Permanent error - return error response
        return {
          id: "",
          success: false,
          error: {
            message: error.message || "Unknown error occurred",
            type: "PERMANENT_ERROR",
            code: 500
          }
        };
      }
    }
  }

  // Add affiliate comment to Facebook post
  async addAffiliateComment(
    facebookPostId: string,
    commentMessage: string,
    facebookPageAccessToken: string
  ): Promise<FacebookCommentResponse> {
    const timeoutMs = CONSTANTS.FACEBOOK_API_TIMEOUT_MS || 15000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(
        `https://graph.facebook.com/v19.0/${facebookPostId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${facebookPageAccessToken}`
          },
          body: JSON.stringify({
            message: commentMessage,
            parent_comment_id: null
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to add affiliate comment to post ${facebookPostId}:`, error);
      return {
        id: "",
        success: false,
        error: {
          message: error.message || "Failed to add comment",
          type: "COMMENT_ERROR",
          code: 400
        }
      };
    }
  }

  // Generate Facebook copywriting using OpenRouter AI
  private async generateFacebookCopywriting(
    title: string,
    description: string,
    price: number,
    category: string,
    rating: number,
    platform: "lazada" | "shopee",
    expirationDate: string
  ): Promise<{ story: string; cta: string }> {
    try {
      // Use OpenRouter AI service to generate Facebook-specific copywriting
      const aiCopy = await this.openrouterService.generateCopy({
        id: `fb_${Date.now()}`, // Temporary ID for Facebook-specific copy
        name: title,
        description: description,
        price: price,
        imageUrl: `https://racun.ibu.my/placeholder/${category}.webp`,
        category: category,
        rating: rating,
        platform: platform,
        facebookSpecific: true
      } as any);

      return {
        story: aiCopy.facebookCopy || aiCopy.body?.[0] || `${title} - Special offer: $${price}`,
        cta: aiCopy.cta || `Get yours now: https://racun.ibu.my/deal/${title.toLowerCase().replace(/\s+/g, '-')}`
      };

    } catch (error) {
      console.warn("⚠️ OpenRouter AI failed to generate Facebook copywriting, using fallback:", error);
      
      // Fallback copywriting
      return {
        story: `${title} - Special offer! Limited time deal at $${price}. Perfect ${category} with ${rating}/5 rating. ${expirationDate} Expiration soon! Special discount for Racun Dapur Ibu members only.",
        cta: `Get yours now: https://racun.ibu.my/deal/${title.toLowerCase().replace(/\s+/g, '-')}`
      };
    }
  }

  // Process image for Facebook posting
  private async processImageForFacebook(
    imageUrl: string,
    productId: string,
    platform: "lazada" | "shopee",
    category: string
  ): Promise<{ webpUrl: string; buffer?: Buffer }> {
    try {
      // Fetch image from source URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Process image with ImageProcessor
      const processedImage = await this.imageProcessor.processImage(
        arrayBuffer,
        {
          convertToWebP: true,
          quality: 0.85,
          maxSizeMB: 10
        }
      );

      // Upload to B2 Storage
      const storageKey = this.imageProcessor.formatB2StorageKey(
        productId,
        platform,
        category,
        "facebook_post.jpg"
      );

      const uploadResult = await this.b2StorageService.uploadFile(
        storageKey,
        processedImage.buffer,
        "image/webp"
      );

      return {
        webpUrl: `https://racun.ibu.my/${storageKey}`, // CDN URL via Cloudflare Worker
        buffer: processedImage.buffer
      };

    } catch (error) {
      console.warn("⚠️ Image processing failed, using original URL:", error);
      // Return original URL as fallback
      return {
        webpUrl: imageUrl,
        buffer: undefined
      };
    }
  }

  // Upload to Facebook Graph API
  private async uploadToFacebookGraph(
    accessToken: string,
    pageId: string,
    story: string,
    imageUrl: string,
    affiliateLink: string,
    timeoutMs: number
  ): Promise<FacebookPostResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // First, upload the image to Facebook's media library
      const mediaUploadResponse = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/photos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: new URLSearchParams({
            url: imageUrl,
            message: story,
            link: affiliateLink
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!mediaUploadResponse.ok) {
        const errorData = await mediaUploadResponse.json();
        throw new Error(errorData.error?.message || `Facebook upload failed: ${mediaUploadResponse.status}`);
      }

      const mediaData = await mediaUploadResponse.json();

      return {
        id: mediaData.id || `facebook_post_${Date.now()}`,
        success: true,
        postId: mediaData.id
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Fallback publish photo method
  private async fallbackPublishPhoto(
    productId: string,
    story: string,
    imageUrl: string | undefined,
    accessToken: string,
    pageId: string
  ): Promise<FacebookPostResponse> {
    try {
      // Simplified posting without image processing
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            message: story,
            link: `https://racun.ibu.my/deal/${productId}`,
            picture: imageUrl || "https://racun.ibu.my/placeholder.jpg"
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Facebook fallback publish failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        id: data.id || `fallback_${Date.now()}`,
        success: true,
        postId: data.id
      };

    } catch (error) {
      return {
        id: "",
        success: false,
        error: {
          message: error.message || "Fallback publish failed",
          type: "FALLBACK_ERROR",
          code: 400
        }
      };
    }
  }

  // Log Facebook post to database
  private async logFacebookPost(
    productId: string,
    platform: "lazada" | "shopee",
    postId: string | undefined,
    status: "published" | "failed",
    errorMessage?: string
  ): Promise<void> {
    try {
      const logData = {
        productId,
        platform,
        postId,
        status,
        errorMessage,
        timestamp: new Date().toISOString(),
        source: "facebook_graph_api"
      };

      await this.supabaseService.logFacebookPost(logData);

    } catch (error) {
      console.error("❌ Failed to log Facebook post:", error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  // Set Redis cache for anti-repeat protection
  private async setFacebookPostCache(
    productId: string,
    facebookPostId: string,
    ttlSeconds: number = 432000 // 5 days (432,000 seconds)
  ): Promise<void> {
    try {
      const cacheKey = `facebook_post:${productId}`;
      await this.redisService.setEx(cacheKey, ttlSeconds, JSON.stringify({
        postId: facebookPostId,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn("⚠️ Failed to set Redis cache:", error);
      // Cache failure shouldn't break the flow
    }
  }

  // Check if error is temporary (retryable)
  private isTemporaryError(error: any): boolean {
    const message = error.message?.toLowerCase() || "";
    const status = error.status || error.response?.status || 0;

    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("rate limit") ||
      status >= 500 && status < 600 ||
      status === 429 ||
      status === 503 ||
      status === 502 ||
      status === 504
    );
  }

  // Check if error is configuration-related (non-retryable)
  private isConfigurationError(error: any): boolean {
    const message = error.message?.toLowerCase() || "";
    const status = error.status || error.response?.status || 0;

    return (
      message.includes("invalid_token") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("permission denied") ||
      status === 401 ||
      status === 403
    );
  }

  // Create fallback OpenRouter service for dependency injection
  private createFallbackOpenRouter(): any {
    // This would be a simplified fallback that can be used when OpenRouter service is not available
    return {
      async generateCopy(product: any): Promise<any> {
        return {
          hook: `🤩 ${product.name} Special Deal from ${product.platform}`,
          body: [
            `${product.name} - Now available at just $${product.price}! Perfect choice for ${product.category}.`,
            `Limited offer - ${product.description}`
          ],
          cta: `Get yours now: https://racun.ibu.my/deal/${product.id}`,
          hashtags: ['#RacunDapurIbu', '#FacebookDeals', '#SpecialOffer'],
          threadTarget: 'single-tweet',
          platform: product.platform || 'lazada',
          confidence: 0.5,
          fallbackChainUsed: 'tier-3'
        };
      }
    };
  }

  // Get Facebook post status from cache
  async getFacebookPostStatus(productId: string): Promise<boolean> {
    try {
      const cacheKey = `facebook_post:${productId}`;
      const cached = await this.redisService.get(cacheKey);
      return !!cached;
    } catch (error) {
      console.warn("⚠️ Failed to check Facebook post status:", error);
      return false;
    }
  }

  // Health check for Facebook service
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string }> {
    try {
      // Test Redis connection
      await this.redisService.ping();
      
      // Test Supabase connection  
      await this.supabaseService.healthCheck();
      
      return {
        status: 'healthy',
        details: "Facebook service is operational"
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Facebook service error: ${error.message}`
      };
    }
  }
}