// AI Visual Image Ranker Service
// Evaluates multiple Lazada product image URLs and selects the highest-CTR visual asset

import { Redis } from "@upstash/redis";
import { OpenAI } from "openai";

interface ImageAnalysis {
  url: string;
  clarity: number;
  aspectRatio: number;
  background: "clean" | "busy" | "distracting";
  trustCues: boolean;
  ctrScore: number;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  };
}

interface ProductImagePayload {
  productId: string;
  images: string[];
  category: "kitchen" | "baby" | "skincare";
  price: number;
  discount: number;
  stock: number;
  rating: number;
}

class AIImageRanker {
  private redis: Redis;
  private openai: OpenAI;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseURL: process.env.OPENROUTER_BASE_URL || "",
    });
  }

  async analyzeImageClarity(imageUrl: string): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an image quality evaluator. Analyze product images for clarity, focusing on sharpness, color accuracy, and professional photography standards. Return a clarity score from 0-100.",
          },
          {
            role: "user",
            content: `Analyze this product image for clarity: ${imageUrl}. Consider sharpness, color accuracy, lighting, and overall professional quality. Return only a numeric score (0-100).`,
          },
        ],
        response_format: { type: "text" },
        max_tokens: 10,
      });

      const score = parseFloat(response.choices[0].message.content || "0");
      return isNaN(score) ? 0 : score;
    } catch (error) {
      console.error("Error analyzing image clarity:", error);
      return 50; // Default middle score
    }
  }

  async analyzeAspectRatio(imageUrl: string): Promise<number> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an image aspect ratio analyzer. Evaluate if the image has a good product-to-background ratio suitable for e-commerce. Return a score from 0-100.",
          },
          {
            role: "user",
            content: `Analyze the aspect ratio of this product image: ${imageUrl}. Consider if the product is well-framed and the background is appropriate for e-commerce. Return only a numeric score (0-100).`,
          },
        ],
        response_format: { type: "text" },
        max_tokens: 10,
      });

      const score = parseFloat(response.choices[0].message.content || "0");
      return isNaN(score) ? 50 : score;
    } catch (error) {
      console.error("Error analyzing aspect ratio:", error);
      return 50;
    }
  }

  async analyzeBackground(
    imageUrl: string,
  ): Promise<"clean" | "busy" | "distracting"> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an image background analyzer. Classify backgrounds as clean, busy, or distracting for product display. Return only one word: clean, busy, or distracting.",
          },
          {
            role: "user",
            content: `Analyze the background of this product image: ${imageUrl}. Classify as clean (simple, professional), busy (crowded), or distracting (unprofessional). Return only one word.`,
          },
        ],
        response_format: { type: "text" },
        max_tokens: 5,
      });

      const result = response.choices[0].message.content?.trim().toLowerCase();
      if (result === "clean" || result === "busy" || result === "distracting") {
        return result;
      }
      return "clean";
    } catch (error) {
      console.error("Error analyzing background:", error);
      return "clean";
    }
  }

  async analyzeTrustCues(imageUrl: string): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a product image trust evaluator. Check for professional trust cues like price tags, measurement labels, brand logos, or quality indicators. Return true if trust cues present, false otherwise.",
          },
          {
            role: "user",
            content: `Analyze this product image for professional trust cues: ${imageUrl}. Look for price tags, measurement labels, brand logos, quality indicators, or professional packaging. Return true if trust cues present, false otherwise.`,
          },
        ],
        response_format: { type: "text" },
        max_tokens: 5,
      });

      const result = response.choices[0].message.content?.trim().toLowerCase();
      return result === "true" || result === "yes";
    } catch (error) {
      console.error("Error analyzing trust cues:", error);
      return false;
    }
  }

  async getImageMetadata(imageUrl: string): Promise<{
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  }> {
    try {
      // Simplified metadata extraction without worker threads
      // In production, this could use a separate service or edge function
      return {};
    } catch (error) {
      console.error("Error getting image metadata:", error);
      return {};
    }
  }

  calculateCTRScore(analysis: ImageAnalysis): number {
    const clarityWeight = 0.3;
    const aspectRatioWeight = 0.2;
    const backgroundWeight =
      analysis.background === "clean"
        ? 0.3
        : analysis.background === "busy"
          ? 0.1
          : 0.0;
    const trustCuesWeight = analysis.trustCues ? 0.2 : 0.0;

    const ctrScore =
      analysis.clarity * clarityWeight +
      analysis.aspectRatio * aspectRatioWeight +
      backgroundWeight * 100 +
      trustCuesWeight * 100;

    return Math.min(ctrScore, 100);
  }

  async analyzeProductImages(
    payload: ProductImagePayload,
  ): Promise<ImageAnalysis> {
    const analyses: ImageAnalysis[] = [];

    for (const imageUrl of payload.images) {
      const analysis: ImageAnalysis = {
        url: imageUrl,
        clarity: 0,
        aspectRatio: 0,
        background: "clean",
        trustCues: false,
        ctrScore: 0,
        metadata: {},
      };

      try {
        analysis.clarity = await this.analyzeImageClarity(imageUrl);
        analysis.aspectRatio = await this.analyzeAspectRatio(imageUrl);
        analysis.background = await this.analyzeBackground(imageUrl);
        analysis.trustCues = await this.analyzeTrustCues(imageUrl);
        analysis.metadata = await this.getImageMetadata(imageUrl);
        analysis.ctrScore = this.calculateCTRScore(analysis);

        analyses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing image ${imageUrl}:`, error);
      }
    }

    if (analyses.length === 0) {
      throw new Error("No images could be analyzed");
    }

    analyses.sort((a, b) => b.ctrScore - a.ctrScore);

    return analyses[0];
  }

  async rankProductImages(
    payload: ProductImagePayload,
  ): Promise<ImageAnalysis> {
    const cacheKey = `product:${payload.productId}:rank:${Date.now()}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      console.error("Error checking cache:", error);
    }

    const rankedImage = await this.analyzeProductImages(payload);

    try {
      await this.redis.setex(cacheKey, 3600, JSON.stringify(rankedImage));
    } catch (error) {
      console.error("Error caching ranked image:", error);
    }

    return rankedImage;
  }

  async processBatch(
    payloads: ProductImagePayload[],
  ): Promise<ImageAnalysis[]> {
    const results: ImageAnalysis[] = [];

    for (const payload of payloads) {
      try {
        const rankedImage = await this.rankProductImages(payload);
        results.push(rankedImage);
      } catch (error) {
        console.error(`Error processing product ${payload.productId}:`, error);
      }
    }

    return results;
  }
}

export { AIImageRanker };
export type { ProductImagePayload, ImageAnalysis };
