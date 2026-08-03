// Social Payload Builder
// Format strict multi-channel payloads: X main post (photo + text without link) -> X reply (affiliate link + CTA); Facebook main post (photo + storytelling without link) -> FB comment 1 (affiliate link + CTA)
// Integrated with AI Hallucination Guard for copy validation

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";
import {
  AiHallucinationGuard,
  HallucinationAuditResult,
  ProductData,
} from "./ai-hallucination-guard";

interface SocialPayload {
  id: string;
  platform: "x" | "facebook";
  postType: "main" | "reply" | "comment";
  content: {
    text: string;
    media?: {
      url: string;
      type: "image" | "video";
      alt?: string;
    };
    affiliateLink?: string;
    cta?: string;
    metadata?: any;
  };
  scheduling: {
    delay: number;
    scheduledAt: number;
  };
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
}

interface ChannelConfig {
  x: {
    mainPost: {
      maxTextLength: number;
      mediaRequired: boolean;
      affiliateLinkAllowed: boolean;
      maxHashtags: number;
      autoReplyEnabled: boolean;
    };
    reply: {
      maxTextLength: number;
      affiliateLinkRequired: boolean;
      ctaRequired: boolean;
      maxCharacters: number;
    };
  };
  facebook: {
    mainPost: {
      maxTextLength: number;
      mediaRequired: boolean;
      affiliateLinkAllowed: boolean;
      storytellingRequired: boolean;
      maxCharacters: number;
    };
    comment: {
      maxTextLength: number;
      affiliateLinkRequired: boolean;
      ctaRequired: boolean;
      autoCommentEnabled: boolean;
    };
  };
}

interface FormattedPayload {
  platform: "x" | "facebook";
  postType: "main" | "reply" | "comment";
  formattedContent: {
    text: string;
    media?: {
      url: string;
      type: "image" | "video";
      alt?: string;
    };
    affiliateLink?: string;
    cta?: string;
    hashtags?: string[];
    mentions?: string[];
    formatting?: {
      bold?: string[];
      italic?: string[];
      links?: string[];
    };
    warningBadge?: boolean;
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  metadata: {
    characterCount: number;
    mediaCount: number;
    affiliateLinkCount: number;
    ctaCount: number;
    culturalScore: number;
    platformCompliance: {
      x: boolean;
      facebook: boolean;
    };
    hallucinationAudit?: {
      score: number;
      isValid: boolean;
      issues: string[];
      retryNeeded: boolean;
    };
  };
}

class SocialPayloadBuilder {
  private redis: Redis;
  private openai: OpenAI;
  private channelConfig: ChannelConfig;
  private hallucinationGuard: AiHallucinationGuard;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    this.hallucinationGuard = new AiHallucinationGuard();

    this.channelConfig = {
      x: {
        mainPost: {
          maxTextLength: 280,
          mediaRequired: true,
          affiliateLinkAllowed: false,
          maxHashtags: 3,
          autoReplyEnabled: true,
        },
        reply: {
          maxTextLength: 280,
          affiliateLinkRequired: true,
          ctaRequired: true,
          maxCharacters: 280,
        },
      },
      facebook: {
        mainPost: {
          maxTextLength: 500,
          mediaRequired: true,
          affiliateLinkAllowed: false,
          storytellingRequired: true,
          maxCharacters: 500,
        },
        comment: {
          maxTextLength: 130,
          affiliateLinkRequired: true,
          ctaRequired: true,
          autoCommentEnabled: true,
        },
      },
    };
  }

  async buildPayload(
    platform: "x" | "facebook",
    postType: "main" | "reply" | "comment",
    content: {
      text: string;
      media?: {
        url: string;
        type: "image" | "video";
        alt?: string;
      };
      affiliateLink?: string;
      cta?: string;
      metadata?: any;
    },
    scheduling: {
      delay: number;
      scheduledAt: number;
    },
    product?: ProductData,
  ): Promise<FormattedPayload> {
    try {
      const payloadId = `${platform}:${postType}:${Date.now()}`;

      const formatted = await this.formatPayload(platform, postType, content);

      // Run AI Hallucination Guard if product data is provided
      let hallucinationAudit: HallucinationAuditResult | null = null;
      let warningBadge = false;

      if (product) {
        hallucinationAudit = await this.hallucinationGuard.auditCopyIntegrity(
          content.text,
          product,
        );

        // Attach warning badge if hallucination guard score is below threshold
        if (hallucinationAudit.score < 0.85) {
          warningBadge = true;
          formatted.formattedContent.text = `[PERINGATAN: Salinan AI tidak sepadan dengan data produk]\n${formatted.formattedContent.text}`;
        }
      }

      const validation = await this.validatePayload(
        platform,
        postType,
        formatted,
      );

      const socialPayload: SocialPayload = {
        id: payloadId,
        platform,
        postType,
        content,
        scheduling,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add hallucination audit to metadata
      if (hallucinationAudit) {
        socialPayload.content.metadata = {
          ...socialPayload.content.metadata,
          hallucinationAudit: {
            score: hallucinationAudit.score,
            isValid: hallucinationAudit.isValid,
            issues: hallucinationAudit.issues,
            retryNeeded: hallucinationAudit.retryNeeded,
          },
          warningBadge,
        };
      }

      await this.cachePayload(payloadId, socialPayload);

      return {
        ...formatted,
        validation,
      };
    } catch (error) {
      console.error("Error building payload:", error);
      throw error;
    }
  }

  private async formatPayload(
    platform: "x" | "facebook",
    postType: "main" | "reply" | "comment",
    content: {
      text: string;
      media?: {
        url: string;
        type: "image" | "video";
        alt?: string;
      };
      affiliateLink?: string;
      cta?: string;
      metadata?: any;
    },
  ): Promise<Omit<FormattedPayload, "validation">> {
    const config = this.channelConfig[platform];
    const postConfig = config[postType as keyof typeof config];

    let formattedText = content.text;
    let formattedAffiliateLink = content.affiliateLink;
    let formattedCta = content.cta;

    switch (platform) {
      case "x":
        if (postType === "main") {
          formattedText = this.formatXMainPost(content);
          formattedAffiliateLink = undefined;
        } else if (postType === "reply") {
          formattedText = this.formatXReply(content);
          formattedCta =
            formattedCta || this.generateXCTA(content.affiliateLink || "");
        }
        break;

      case "facebook":
        if (postType === "main") {
          formattedText = this.formatFacebookMainPost(content);
          formattedAffiliateLink = undefined;
        } else if (postType === "comment") {
          formattedText = this.formatFacebookComment(content);
          formattedCta =
            formattedCta ||
            this.generateFacebookCTA(content.affiliateLink || "");
        }
        break;
    }

    const hashtags = this.extractHashtags(formattedText);
    const mentions = this.extractMentions(formattedText);
    const formatting = this.extractFormatting(formattedText);

    const metadata = {
      characterCount: formattedText.length,
      mediaCount: content.media ? 1 : 0,
      affiliateLinkCount: formattedAffiliateLink ? 1 : 0,
      ctaCount: formattedCta ? 1 : 0,
      culturalScore: await this.calculateCulturalScore(formattedText, platform),
      platformCompliance: {
        x:
          platform === "x"
            ? this.validateXCompliance(formattedText, postType)
            : true,
        facebook:
          platform === "facebook"
            ? this.validateFacebookCompliance(formattedText, postType)
            : true,
      },
    };

    return {
      platform,
      postType,
      formattedContent: {
        text: formattedText,
        media: content.media,
        affiliateLink: formattedAffiliateLink,
        cta: formattedCta,
        hashtags,
        mentions,
        formatting,
      },
      metadata,
    };
  }

  private formatXMainPost(content: any): string {
    let formatted = content.text;

    if (content.media) {
      formatted = `🖼️ ${formatted}`;
    }

    formatted = this.addXMentions(formatted);
    formatted = this.addXHashtags(formatted);
    formatted = this.addXEmojis(formatted);

    return formatted.trim();
  }

  private formatXReply(content: any): string {
    let formatted = content.text;

    if (content.affiliateLink) {
      formatted = `${formatted} ${content.affiliateLink}`;
    }

    if (content.cta) {
      formatted = `${formatted} ${content.cta}`;
    }

    formatted = this.addXMentions(formatted);
    formatted = this.addXHashtags(formatted);
    formatted = this.addXEmojis(formatted);

    return formatted.trim();
  }

  private formatFacebookMainPost(content: any): string {
    let formatted = content.text;

    if (content.media) {
      formatted = `🖼️ ${formatted}`;
    }

    formatted = this.addFacebookStorytelling(formatted);
    formatted = this.addFacebookEmojis(formatted);

    return formatted.trim();
  }

  private formatFacebookComment(content: any): string {
    let formatted = content.text;

    if (content.affiliateLink) {
      formatted = `${formatted} ${content.affiliateLink}`;
    }

    if (content.cta) {
      formatted = `${formatted} ${content.cta}`;
    }

    formatted = this.addFacebookEmojis(formatted);

    return formatted.trim();
  }

  private addXMentions(text: string): string {
    const mentions = text.match(/@\w+/g) || [];
    if (mentions.length > 0) {
      return text;
    }
    return text;
  }

  private addXHashtags(text: string): string {
    const hashtags = text.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g) || [];
    if (hashtags.length > 0) {
      return text;
    }
    return text;
  }

  private addXEmojis(text: string): string {
    const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
    if (emojiCount > 5) {
      return text;
    }
    return text;
  }

  private addFacebookStorytelling(text: string): string {
    const storytellingIndicators = [
      "story",
      "experience",
      "journey",
      "family",
      "mom",
      "parenting",
      "life",
      "daily",
      "routine",
      "home",
      "kitchen",
      "cooking",
    ];

    const hasStorytelling = storytellingIndicators.some((indicator) =>
      text.toLowerCase().includes(indicator),
    );

    if (!hasStorytelling) {
      return `${text} 

Share our Malaysian parenting journey and kitchen adventures! 💕`;
    }

    return text;
  }

  private addFacebookEmojis(text: string): string {
    const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
    if (emojiCount > 3) {
      return text;
    }
    return text;
  }

  private generateXCTA(affiliateLink: string): string {
    return `🔗 ${affiliateLink}`;
  }

  private generateFacebookCTA(affiliateLink: string): string {
    return `💖 ${affiliateLink}`;
  }

  private extractHashtags(text: string): string[] {
    return (text.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).slice(0, 3);
  }

  private extractMentions(text: string): string[] {
    return (text.match(/@\w+/g) || []).slice(0, 2);
  }

  private extractFormatting(text: string): any {
    const bold = text.match(/\*\*([^*]+)\*\*/g) || [];
    const italic = text.match(/\*([^*]+)\*/g) || [];
    const links = text.match(/https?:\/\/[^\s]+/g) || [];

    return {
      bold: bold.map((b) => b.replace(/\*\*/g, "")),
      italic: italic.map((i) => i.replace(/\*/g, "")),
      links,
    };
  }

  private async calculateCulturalScore(
    text: string,
    platform: "x" | "facebook",
  ): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a Malaysian cultural evaluator. Analyze text for cultural relevance, appropriate tone, and Malaysian context. Return a score from 0-1.",
          },
          {
            role: "user",
            content: `Analyze this ${platform} content for Malaysian cultural relevance: ${text}. Consider language, customs, values, and appropriateness for Malaysian audience. Return only a numeric score (0-1).`,
          },
        ],
        response_format: { type: "text" },
        max_tokens: 5,
      });

      const score = parseFloat(response.choices[0].message.content || "");
      return isNaN(score) ? 0.7 : score;
    } catch (error) {
      console.error("Error calculating cultural score:", error);
      return 0.7;
    }
  }

  private validateXCompliance(
    text: string,
    postType: "main" | "reply" | "comment",
  ): boolean {
    const config = this.channelConfig.x[
      postType as keyof typeof this.channelConfig.x
    ] as
      | {
          maxTextLength: number;
          mediaRequired: boolean;
          affiliateLinkAllowed: boolean;
          maxHashtags: number;
          autoReplyEnabled: boolean;
        }
      | {
          maxTextLength: number;
          affiliateLinkRequired: boolean;
          ctaRequired: boolean;
          maxCharacters: number;
        };

    if (text.length > config.maxTextLength) return false;
    if (
      postType === "main" &&
      !("mediaRequired" in config && config.mediaRequired)
    )
      return false;
    if (
      postType === "reply" &&
      !("affiliateLinkRequired" in config && config.affiliateLinkRequired)
    )
      return false;
    if (
      postType === "reply" &&
      !("ctaRequired" in config && config.ctaRequired)
    )
      return false;

    return true;
  }

  private validateFacebookCompliance(
    text: string,
    postType: "main" | "reply" | "comment",
  ): boolean {
    const config = this.channelConfig.facebook[
      postType as keyof typeof this.channelConfig.facebook
    ] as
      | {
          maxTextLength: number;
          mediaRequired: boolean;
          affiliateLinkAllowed: boolean;
          storytellingRequired: boolean;
          maxCharacters: number;
        }
      | {
          maxTextLength: number;
          affiliateLinkRequired: boolean;
          ctaRequired: boolean;
          autoCommentEnabled: boolean;
        };

    if (text.length > config.maxTextLength) return false;
    if (
      postType === "main" &&
      !("mediaRequired" in config && config.mediaRequired)
    )
      return false;
    if (
      postType === "main" &&
      !("storytellingRequired" in config && config.storytellingRequired)
    )
      return false;
    if (
      postType === "comment" &&
      !("affiliateLinkRequired" in config && config.affiliateLinkRequired)
    )
      return false;
    if (
      postType === "comment" &&
      !("ctaRequired" in config && config.ctaRequired)
    )
      return false;

    return true;
  }

  private async validatePayload(
    platform: "x" | "facebook",
    postType: "main" | "reply" | "comment",
    formatted: Omit<FormattedPayload, "validation">,
  ): Promise<FormattedPayload["validation"]> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const config = this.channelConfig[platform][
      postType as keyof (typeof this.channelConfig)[typeof platform]
    ] as any;

    if (formatted.metadata.characterCount > config.maxTextLength) {
      errors.push(
        `Exceeds maximum character limit for ${platform} ${postType}`,
      );
    }

    if (formatted.formattedContent.media && !config.mediaRequired) {
      warnings.push("Media not required for this post type");
    }

    if (
      postType === "reply" &&
      platform === "x" &&
      !formatted.formattedContent.affiliateLink
    ) {
      errors.push("Affiliate link required for X reply");
    }

    if (
      postType === "reply" &&
      platform === "x" &&
      !formatted.formattedContent.cta
    ) {
      errors.push("CTA required for X reply");
    }

    if (
      postType === "comment" &&
      platform === "facebook" &&
      !formatted.formattedContent.affiliateLink
    ) {
      errors.push("Affiliate link required for Facebook comment");
    }

    if (
      postType === "comment" &&
      platform === "facebook" &&
      !formatted.formattedContent.cta
    ) {
      errors.push("CTA required for Facebook comment");
    }

    if (formatted.metadata.culturalScore < 0.6) {
      warnings.push("Low cultural relevance score");
    }

    if (!formatted.metadata.platformCompliance[platform]) {
      errors.push(`Non-compliant with ${platform} platform guidelines`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async cachePayload(
    payloadId: string,
    payload: SocialPayload,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `payload:${payloadId}`,
        86400,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error("Error caching payload:", error);
    }
  }

  async getPayload(payloadId: string): Promise<SocialPayload | null> {
    try {
      const cached = await this.redis.get(`payload:${payloadId}`);
      if (cached) {
        return JSON.parse(cached as string);
      }
      return null;
    } catch (error) {
      console.error("Error getting payload:", error);
      return null;
    }
  }

  async getPayloadsByPlatform(
    platform: "x" | "facebook",
    status: "pending" | "processing" | "completed" | "failed" = "pending",
    limit: number = 10,
  ): Promise<SocialPayload[]> {
    try {
      const keys = await this.redis.keys(`payload:*`);
      const payloads: SocialPayload[] = [];

      for (const key of keys.slice(0, 100)) {
        const payload = await this.redis.get(key);
        if (payload) {
          const parsed = JSON.parse(payload as string);
          if (parsed.platform === platform && parsed.status === status) {
            payloads.push(parsed);
          }
        }
      }

      return payloads.slice(0, limit);
    } catch (error) {
      console.error("Error getting payloads by platform:", error);
      return [];
    }
  }

  async updatePayloadStatus(
    payloadId: string,
    status: "pending" | "processing" | "completed" | "failed",
  ): Promise<void> {
    try {
      const payload = await this.getPayload(payloadId);
      if (!payload) return;

      payload.status = status;
      payload.updatedAt = Date.now();

      await this.redis.setex(
        `payload:${payloadId}`,
        86400,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error("Error updating payload status:", error);
    }
  }

  async getPayloadStats(): Promise<any> {
    try {
      const keys = await this.redis.keys(`payload:*`);
      const stats: any = {
        total: keys.length,
        byPlatform: { x: 0, facebook: 0 },
        byStatus: { pending: 0, processing: 0, completed: 0, failed: 0 },
        byPostType: { main: 0, reply: 0, comment: 0 },
      };

      for (const key of keys.slice(0, 100)) {
        const payload = await this.redis.get(key);
        if (payload) {
          const parsed = JSON.parse(payload as string);
          stats.byPlatform[parsed.platform] =
            (stats.byPlatform[parsed.platform] || 0) + 1;
          stats.byStatus[parsed.status] =
            (stats.byStatus[parsed.status] || 0) + 1;
          stats.byPostType[parsed.postType] =
            (stats.byPostType[parsed.postType] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting payload stats:", error);
      return null;
    }
  }

  async cleanupOldPayloads(
    olderThan: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const key of await this.redis.keys(`payload:*`)) {
        const payload = await this.redis.get(key);
        if (payload) {
          const parsed = JSON.parse(payload as string);
          if (now - parsed.createdAt > olderThan) {
            keysToDelete.push(key);
          }
        }
      }

      for (const key of keysToDelete) {
        await this.redis.del(key);
      }
    } catch (error) {
      console.error("Error cleaning up old payloads:", error);
    }
  }

  async generateBatchPayloads(
    products: any[],
    platform: "x" | "facebook",
    count: number = 5,
  ): Promise<FormattedPayload[]> {
    const payloads: FormattedPayload[] = [];

    for (let i = 0; i < Math.min(count, products.length); i++) {
      const product = products[i];

      const content = {
        text:
          product.description ||
          `Check out this ${product.category} product! ${product.name}`,
        media:
          product.images && product.images.length > 0
            ? {
                url: String(product.images[0]),
                type: "image" as const,
                alt: product.name,
              }
            : undefined,
        affiliateLink: product.affiliateLink,
        cta: product.cta || `Get yours now! ${product.affiliateLink}`,
        metadata: product.metadata,
      };

      const scheduling = {
        delay: Math.floor(Math.random() * 3) + 3,
        scheduledAt: Date.now() + (Math.floor(Math.random() * 3) + 3) * 1000,
      };

      try {
        const payload = await this.buildPayload(
          platform,
          "main",
          content,
          scheduling,
        );
        if (payload.validation.isValid) {
          payloads.push(payload);
        }
      } catch (error) {
        console.error(
          `Error generating payload for product ${product.id}:`,
          error,
        );
      }
    }

    return payloads;
  }
}

export { SocialPayloadBuilder };
export type { SocialPayload, FormattedPayload, ChannelConfig };
