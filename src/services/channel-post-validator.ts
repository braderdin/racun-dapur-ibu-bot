/*
 * Dual-Channel Content Formatting & Zod Validation Service
 * Phase 6: Zod schema validation for X (2-tweet thread) + Facebook (storytelling post + auto-comment)
 * Ensures zero malformed payloads across dual-channel posting pipeline
 */

import { z } from "zod";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

// X (Twitter) Content Schemas
const xTweet1Schema = z.object({
  content: z.string()
    .min(1, "Tweet 1 content cannot be empty")
    .max(280, "Tweet 1 content cannot exceed 280 characters")
    .regex(/^[^\x00-\x1F\x7F]*$/, "Tweet 1 content contains control characters"),
  isHook: z.boolean().default(true),
  mediaUrl: z.string().url().optional(),
  hasLink: z.boolean().default(false),
});

const xTweet2Schema = z.object({
  content: z.string()
    .min(1, "Tweet 2 content cannot be empty")
    .max(280, "Tweet 2 content cannot exceed 280 characters")
    .regex(/^[^\x00-\x1F\x7F]*$/, "Tweet 2 content contains control characters"),
  affiliateUrl: z.string().url("Invalid affiliate URL format"),
  ctaText: z.string().min(1, "CTA text cannot be empty"),
  isAutoReply: z.boolean().default(true),
});

export const xContentSchema = z.object({
  tweet1: xTweet1Schema,
  tweet2: xTweet2Schema,
  threadType: z.literal("2-tweet-thread").default("2-tweet-thread"),
  platform: z.literal("x"),
});

// Facebook Content Schemas
const fbPostSchema = z.object({
  content: z.string()
    .min(10, "Post content must be at least 10 characters")
    .max(500, "Post content cannot exceed 500 characters")
    .regex(/^[^\x00-\x1F\x7F]*$/, "Post content contains control characters"),
  storytelling: z.boolean().default(true),
  mediaUrl: z.string().url().optional(),
  priceDisplay: z.boolean().default(true),
  urgencyWords: z.array(z.string()).min(1, "Post should include urgency words"),
});

const fbAutoCommentSchema = z.object({
  affiliateUrl: z.string().url("Invalid affiliate URL format"),
  commentText: z.string()
    .min(5, "Auto-comment text must be at least 5 characters")
    .max(280, "Auto-comment text cannot exceed 280 characters"),
  isReply: z.boolean().default(true),
});

export const fbContentSchema = z.object({
  post: fbPostSchema,
  autoComment: fbAutoCommentSchema,
  storyType: z.literal("storytelling-post").default("storytelling-post"),
  platform: z.literal("facebook"),
});

// Union schema for any platform content
export const anyContentSchema = z.union([xContentSchema, fbContentSchema]);

// Enums and Constants
export const PLATFORM_TYPE = {
  X: "x",
  FACEBOOK: "facebook",
} as const;

export const CONTENT_TYPE = {
  TWEET_THREAD: "2-tweet-thread",
  STORYtelling_POST: "storytelling-post",
} as const;

export interface ValidatedXContent {
  tweet1: z.infer<typeof xTweet1Schema>;
  tweet2: z.infer<typeof xTweet2Schema>;
  threadType: "2-tweet-thread";
  platform: "x";
}

export interface ValidatedFBContent {
  post: z.infer<typeof fbPostSchema>;
  autoComment: z.infer<typeof fbAutoCommentSchema>;
  storyType: "storytelling-post";
  platform: "facebook";
}

export type AnyContent = ValidatedXContent | ValidatedFBContent;

export class ChannelPostValidator {
  private platformConfig: Map<string, {
    maxContentLength: number;
    minContentLength: number;
    urgencyWords: string[];
    hashtags: string;
  }>;

  constructor() {
    // Initialize platform-specific configurations
    this.platformConfig = new Map([
      [
        PLATFORM_TYPE.X,
        {
          maxContentLength: 280,
          minContentLength: 1,
          urgencyWords: ["🔥", "⚡", "🎉", "💰", "🚀"],
          hashtags: CONSTANTS.BRAND_HASHTAGS,
        },
      ],
      [
        PLATFORM_TYPE.FACEBOOK,
        {
          maxContentLength: 500,
          minContentLength: 10,
          urgencyWords: ["NEW", "LIMITED", "EXCLUSIVE", "DISCOUNT", "TODAY"],
          hashtags: CONSTANTS.BRAND_HASHTAGS,
        },
      ],
    ]);
  }

  validateContent<T extends AnyContent>(content: T, platform: string): {
    success: boolean;
    data?: T;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    try {
      // Validate platform-specific schema
      const platformSchema = this.getPlatformSchema(platform);
      const validatedData = platformSchema.parse(content) as T;

      // Additional platform-specific validations
      this.performAdditionalValidations(validatedData, platform, warnings);

      logger.info("Content validation successful", {
        platform,
        contentType: this.getContentType(validatedData),
        warnings: warnings.length,
      }, "ChannelPostValidator");

      return {
        success: true,
        data: validatedData,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");
        
        logger.error("Content validation failed", {
          platform,
          error: errorMessages,
        }, "ChannelPostValidator");

        return {
          success: false,
          error: `Validation failed: ${errorMessages}`,
        };
      }

      logger.error("Unexpected validation error", {
        platform,
        error: error instanceof Error ? error.message : String(error),
      }, "ChannelPostValidator");

      return {
        success: false,
        error: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private getPlatformSchema(platform: string): z.ZodSchema {
    switch (platform.toLowerCase()) {
      case PLATFORM_TYPE.X:
        return xContentSchema;
      case PLATFORM_TYPE.FACEBOOK:
        return fbContentSchema;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private performAdditionalValidations(
    content: AnyContent,
    platform: string,
    warnings: string[]
  ): void {
    const config = this.platformConfig.get(platform);
    if (!config) return;

    // Check for required urgency words based on content type
    if (content.platform === PLATFORM_TYPE.X) {
      this.validateXTweetContent(content as ValidatedXContent, config, warnings);
    } else if (content.platform === PLATFORM_TYPE.FACEBOOK) {
      this.validateFBCustomerPost(content as ValidatedFBContent, config, warnings);
    }
  }

  private validateXTweetContent(
    content: ValidatedXContent,
    config: { urgencyWords: string[] },
    warnings: string[]
  ): void {
    // Check if tweet 1 contains hook markers
    if (!content.tweet1.isHook) {
      warnings.push("Tweet 1 is marked as not being a hook - may reduce engagement");
    }

    // Check if tweet 2 contains affiliate link
    if (!content.tweet2.affiliateUrl) {
      warnings.push("Tweet 2 missing affiliate link - reduces conversion potential");
    }

    // Validate hashtag presence
    const combinedText = `${content.tweet1.content} ${content.tweet2.content}`.toLowerCase();
    const hashtagsInContent = config.hashtags
      .split(" ")
      .filter((tag) => tag.length > 0)
      .some((tag) => combinedText.includes(tag.toLowerCase()));

    if (!hashtagsInContent) {
      warnings.push(`Content should include brand hashtags: ${config.hashtags}`);
    }
  }

  private validateFBCustomerPost(
    content: ValidatedFBContent,
    config: { urgencyWords: string[] },
    warnings: string[]
  ): void {
    // Check if post contains storytelling elements
    if (!content.post.storytelling) {
      warnings.push("Post should be in storytelling format for better engagement");
    }

    // Check if post includes price display
    if (!content.post.priceDisplay) {
      warnings.push("Post should include price display for transparency");
    }

    // Validate urgency words in post content
    const postText = content.post.content.toLowerCase();
    const hasUrgency = config.urgencyWords.some((word) => postText.includes(word.toLowerCase()));
    if (!hasUrgency) {
      warnings.push(`Post should include urgency words: ${config.urgencyWords.join(", ")}`);
    }
  }

  private getContentType(content: AnyContent): string {
    return content.threadType || content.storyType;
  }

  validateForPlatform(
    content: AnyContent,
    platform: string
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const validation = this.validateContent(content, platform);
    const errors: string[] = [];

    if (!validation.success) {
      errors.push(validation.error || "Unknown validation error");
    }

    const warnings = validation.warnings || [];

    return {
      isValid: validation.success,
      errors,
      warnings,
    };
  }

  generateContentSkeleton(platform: string): AnyContent {
    switch (platform.toLowerCase()) {
      case PLATFORM_TYPE.X:
        return {
          threadType: "2-tweet-thread" as const,
          platform: PLATFORM_TYPE.X,
          tweet1: {
            content: "Hook: Discover amazing kitchen solutions!",
            isHook: true,
            hasLink: false,
          },
          tweet2: {
            content: "Limited time offer - Shop now! Use code SAVE20",
            affiliateUrl: "https://racun.ibu.my/deal",
            ctaText: "Shop Now",
            isAutoReply: true,
          },
        };
      case PLATFORM_TYPE.FACEBOOK:
        return {
          storyType: "storytelling-post" as const,
          platform: PLATFORM_TYPE.FACEBOOK,
          post: {
            content:
              "Story: How our family transformed their kitchen with simple solutions",
            storytelling: true,
            priceDisplay: true,
            urgencyWords: ["LIMITED", "TODAY"],
          },
          autoComment: {
            affiliateUrl: "https://racun.ibu.my/deal",
            commentText: "Get yours now - Click for exclusive offer!",
            isReply: true,
          },
        };
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  getValidationRules(platform: string): {
    maxLength: number;
    minLength: number;
    requiredFields: string[];
    optionalFields: string[];
  } {
    const config = this.platformConfig.get(platform);
    if (!config) {
      throw new Error(`No validation rules found for platform: ${platform}`);
    }

    return {
      maxLength: config.maxContentLength,
      minLength: config.minContentLength,
      requiredFields: ["content"],
      optionalFields: ["mediaUrl", "hashtag"],
    };
  }
}

export { ChannelPostValidator as default };