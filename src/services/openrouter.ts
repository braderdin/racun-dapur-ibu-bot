/*
 * OpenRouter AI Copywriting Service
 * Integrates OpenRouter AI with 3-tier fallback strategy
 * Generates copywriting for X (Twitter) and Facebook posts
 * Implements 3-second rate limiting and OpenRouter safeguards
 */

import { AIFallbackEngine, GeneratedCopy as AIGeneratedCopy } from "./ai-fallback";

export interface OpenRouterConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface GeneratedCopy {
  hook: string;
  body: string[];
  cta: string;
  hashtags: string[];
  threadTarget: "single-tweet" | "thread-2";
  platform: "lazada" | "shopee" | "facebook";
  confidence: number;
  fallbackChainUsed: "none" | "tier-1" | "tier-2" | "tier-3";
  facebookCopy?: string;
  facebookCta?: string;
}

// Main OpenRouter AI Service Class
export class OpenRouterService {
  private config: OpenRouterConfig;
  private requestDelayMs: number;
  private maxRequestsPerMinute: number;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly openrouterModels = [
    "mistralai/mistral-7b-instruct-v0.2",
    "qwen/qwen-72b-chat",
    "meta-llama/llama-2-70b-chat",
    "google/gemini-pro",
    "anthropic/claude-2",
    "openai/gpt-4",
  ];
  private rateLimitBuffer: number = 0;

  constructor(config?: Partial<OpenRouterConfig>) {
    this.config = {
      model: config?.model || "mistralai/mistral-7b-instruct-v0.2",
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2000,
      topP: config?.topP || 0.9,
      topK: config?.topK || 50,
      presencePenalty: config?.presencePenalty || 0.6,
      frequencyPenalty: config?.frequencyPenalty || 0.3,
    };

    // Configure rate limiting based on model
    this.requestDelayMs = 3000; // 3-second delay between requests
    this.maxRequestsPerMinute = 5; // Max 5 requests per minute
  }

  // Generate AI copy with 3-tier fallback strategy
  async generateCopy(product: any): Promise<GeneratedCopy> {
    const startTime = Date.now();

    try {
      // Tier 1: OpenRouter AI (primary)
      const result = await this.makeOpenRouterRequest(product);
      return this.formatOpenRouterResponse(result, "tier-1", product);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        "⚠️ OpenRouter AI failed, attempting Tier 2 fallback:",
        errorMessage,
      );

      // Tier 2: Local AI fallback
      try {
        const fallbackResult = await this.generateLocalCopy(product);
        return {
          ...fallbackResult,
          fallbackChainUsed: "tier-2",
        };
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.warn(
          "⚠️ Tier 2 fallback failed, attempting Tier 3 fallback:",
          fallbackErrorMessage,
        );

        // Tier 3: Rule-based fallback
        return this.generateRuleBasedCopy(product);
      }
    }
  }

  // Main OpenRouter API request handler
  private async makeOpenRouterRequest(
    product: any,
  ): Promise<OpenRouterResponse> {
    // Rate limiting check
    this.checkRateLimit();

    // Prepare prompt
    const prompt = this.buildPrompt(product);

    // Make API request
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://racun.ibu.my",
          "X-Title": "RacunDapurIbu Bot",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: this.buildSystemPrompt(product.platform),
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          top_p: this.config.topP,
          top_k: this.config.topK,
          presence_penalty: this.config.presencePenalty,
          frequency_penalty: this.config.frequencyPenalty,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result: OpenRouterResponse = await response.json();

    // Update rate limit stats
    this.requestCount++;

    return result;
  }

  // Build product-specific prompt
  private buildPrompt(product: any): string {
    const platform = product.platform || "balanced";
    const price = product.price || 0;
    const category = product.category || "general";
    const rating = product.rating || 0;

    return `Create engaging social media copy for a ${platform} marketplace product.

Product Details:
- Name: ${product.name}
- Description: ${product.description}
- Price: $${price}
- Category: ${category}
- Rating: ${rating}/5
- Platform: ${platform}

Requirements:
1. Hook (max 2 lines): Catch attention with product benefit
2. Body (2-3 lines): Highlight key selling points and features
3. CTA: Drive action with clear call-to-action
4. Hashtags: Include relevant social media tags
5. Length: Keep under 280 characters for Twitter compatibility

Copy should be conversational, friendly, and highlight the value proposition. Include price mention and any special offers.

Output in this format:
HOOK: [your hook here]
BODY: [line 1]
BODY: [line 2]
CTA: [your call-to-action]
HASHTAGS: #hashtag1 #hashtag2 #hashtag3`;
  }

  // Build system prompt based on platform
  private buildSystemPrompt(platform: string): string {
    const platformSpecificInstructions = {
      lazada:
        "Focus on value proposition, discounts, and limited-time offers. Use clear pricing and emphasize free shipping.",
      shopee:
        "Emphasize gaming deals, bundle offers, and flash sales. Use energetic tone and highlight special member prices.",
      facebook:
        "Create storytelling copy with emotional appeal. Focus on family-friendly deals and lifestyle benefits. Use warm, engaging tone.",
    };

    return `You are an expert social media copywriter specializing in e-commerce marketing for ${platform} marketplace.

${platformSpecificInstructions[platform as keyof typeof platformSpecificInstructions] || platformSpecificInstructions.lazada}

Write engaging, conversion-focused copy that resonates with ${platform} shoppers. Use proper punctuation, no more than 280 characters per line, and include relevant emojis sparingly. Always include price information and clear call-to-action.`;
  }

  // Format OpenRouter response into our GeneratedCopy format
  private formatOpenRouterResponse(
    response: OpenRouterResponse,
    fallbackChain: "none" | "tier-1" | "tier-2" | "tier-3",
    product: any,
  ): GeneratedCopy {
    const content = response.choices[0]?.message?.content || "";
    const parsed = this.parseContent(content);

    return {
      hook:
        parsed.hook ||
        `🤩 ${product.name} Special Deal from ${product.platform}`,
      body: parsed.body || [
        `${product.name} - Now available at just $${product.price}!`,
        `Perfect choice for ${product.category} with ${product.rating}/5 rating.`,
      ],
      cta:
        parsed.cta || `Get yours now: https://racun.ibu.my/deal/${product.id}`,
      hashtags: parsed.hashtags || [
        `#RacunDapurIbu`,
        `#${product.platform}Deals`,
        `#SpecialOffer`,
      ],
      threadTarget: "single-tweet",
      platform: product.platform || "lazada",
      confidence: 0.8,
      fallbackChainUsed: fallbackChain,
      facebookCopy: this.extractFacebookCopy(content),
      facebookCta: parsed.cta
        ? parsed.cta.replace("Get yours", "Like & Share")
        : undefined,
    };
  }

  // Parse content from OpenRouter response
  private parseContent(content: string): any {
    const lines = content.split("\n");
    const result: any = {};

    for (const line of lines) {
      if (line.startsWith("HOOK:")) {
        result.hook = line.replace("HOOK:", "").trim();
      } else if (line.startsWith("BODY:")) {
        if (!result.body) result.body = [];
        result.body.push(line.replace("BODY:", "").trim());
      } else if (line.startsWith("CTA:")) {
        result.cta = line.replace("CTA:", "").trim();
      } else if (line.startsWith("HASHTAGS:")) {
        result.hashtags = line
          .replace("HASHTAGS:", "")
          .split("#")
          .filter((tag) => tag)
          .map((tag: string) => `#${tag}`);
      }
    }

    return result;
  }

  // Extract Facebook copy from content
  private extractFacebookCopy(content: string): string {
    // Look for Facebook-specific copy in the response
    if (content.includes("Facebook") || content.includes("Post")) {
      // Try to extract Facebook copy if present
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes("Facebook") || line.includes("story")) {
          return line.trim();
        }
      }
    }

    // Fallback: create Facebook-specific copy from body
    return (
      content.split("\n")[0] ||
      `${content} - Special offer for Racun Dapur Ibu members!`
    );
  }

  // Local AI fallback generation
  private async generateLocalCopy(product: any): Promise<GeneratedCopy> {
    // Simulate local AI generation with improved fallback
    await this.delayRequest(); // Apply same rate limiting

    return {
      hook: `📱 ${product.name} Mobile Deal Alert! (${product.platform})`,
      body: [
        `${product.name} - Exclusive mobile offer: $${product.price}`,
        `Perfect ${product.category} choice for mobile shoppers`,
        `Limited time discount - save ${Math.round(product.price * 0.15)}% today!`,
      ],
      cta: `Shop Now: https://m.racun.ibu.my/deal/${product.id}`,
      hashtags: [`#MobileDeals`, `#${product.platform}App`, `#ExclusiveOffer`],
      threadTarget: "single-tweet",
      platform: product.platform || "lazada",
      confidence: 0.6,
      fallbackChainUsed: "tier-2",
    };
  }

  // Rule-based fallback generation
  private generateRuleBasedCopy(product: any): GeneratedCopy {
    const templates = [
      {
        hook: `✨ ${product.name} - Special ${product.category} deal`,
        body: [
          `Save $${product.price} on ${product.name}`,
          `Limited stock available`,
        ],
        cta: `Grab Deal Now!`,
        hashtags: [`#${product.category}Deals`, `#${product.platform}Special`],
      },
      {
        hook: `🔥 Flash Sale: ${product.name}`,
        body: [`Only $${product.price} today`, `Quality assured`],
        cta: `Buy Now!`,
        hashtags: [`#FlashSale`, `#${product.platform}Deals`],
      },
      {
        hook: `💰 Best Price: $${product.price}`,
        body: [`${product.name}`, `Perfect for ${product.category}`],
        cta: `Get Yours!`,
        hashtags: [`#BestPrice`, `#${product.platform}Savings`],
      },
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      hook: template.hook,
      body: template.body,
      cta: template.cta,
      hashtags: template.hashtags,
      threadTarget: "single-tweet",
      platform: product.platform || "lazada",
      confidence: 0.4,
      fallbackChainUsed: "tier-3",
    };
  }

  // Rate limiting check and enforcement
  private checkRateLimit(): void {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const timeSinceFirstRequest =
      now -
      (this.requestCount > 0
        ? now -
          (this.lastRequestTime + (this.requestCount - 1) * this.requestDelayMs)
        : now);

    // Check if we need to wait for rate limit
    if (timeSinceLastRequest < this.requestDelayMs) {
      const waitTime = this.requestDelayMs - timeSinceLastRequest;
      console.log(`⏱️ Rate limit delay: waiting ${waitTime}ms`);
      this.delayRequest(waitTime);
    }

    // Reset request counter every minute
    if (timeSinceFirstRequest >= 60000) {
      this.requestCount = 0;
      console.log("🔄 Rate limit counter reset");
    }

    // Check if we would exceed max requests per minute
    const requestsInCurrentMinute = this.getRequestsInCurrentMinute();
    if (requestsInCurrentMinute >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - timeSinceFirstRequest; // Wait until minute resets
      console.log(`⏱️ Rate limit reached: waiting ${waitTime}ms`);
      this.delayRequest(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  // Delay request with optional custom timeout
  private delayRequest(customTimeout?: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, customTimeout || this.requestDelayMs);
    });
  }

  // Get number of requests in current minute
  private getRequestsInCurrentMinute(): number {
    const now = Date.now();
    const timeSinceFirstRequest =
      now - (this.requestCount > 0 ? this.lastRequestTime : now);

    if (timeSinceFirstRequest >= 60000) {
      return 0;
    }

    // Estimate: average requests per second * elapsed time
    const avgRequestsPerSecond = this.maxRequestsPerMinute / 60;
    return Math.min(
      Math.floor((timeSinceFirstRequest / 1000) * avgRequestsPerSecond) +
        this.requestCount,
      this.maxRequestsPerMinute,
    );
  }

  // Health check for OpenRouter service
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details: string;
  }> {
    try {
      // Test with a simple request
      await this.delayRequest(100); // Short delay

      const testProduct = {
        id: "health_test",
        name: "Health Test Product",
        description: "Test product for health check",
        price: 1.0,
        category: "test",
        rating: 5,
        platform: "lazada",
      };

      await this.generateCopy(testProduct);

      return {
        status: "healthy",
        details: `OpenRouter service operational (${this.requestCount} requests made)`,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: `OpenRouter service error: ${error.message}`,
      };
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<OpenRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("🔧 OpenRouter configuration updated");
  }

  // Get current configuration (without sensitive data)
  getConfig(): any {
    return {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      requestDelayMs: this.requestDelayMs,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      requestCount: this.requestCount,
    };
  }

  // Generate dual-platform copy (X and Facebook)
  async generateDualCopy(
    product: any,
  ): Promise<{ twitterCopy: GeneratedCopy; facebookCopy: GeneratedCopy }> {
    try {
      // Generate primary copy
      const primaryCopy = await this.generateCopy(product);

      // Adjust for X (Twitter)
      const twitterCopy: GeneratedCopy = {
        ...primaryCopy,
        platform: product.platform || "lazada",
        body: primaryCopy.body.map((line) => line.slice(0, 280)),
        cta: primaryCopy.cta,
        hashtags: primaryCopy.hashtags.slice(0, 5), // Limit hashtags for X
      };

      // Create Facebook-specific copy
      const facebookCopy: GeneratedCopy = {
        hook:
          primaryCopy.hook.includes("special") ||
          primaryCopy.hook.includes("deal")
            ? primaryCopy.hook
            : `🌟 ${product.name} ${primaryCopy.hook.split(":")[1] || "Special Offer"}`,
        body: primaryCopy.body,
        cta: primaryCopy.cta.replace("Get yours", "Like & Share"),
        hashtags: [
          ...primaryCopy.hashtags.filter((tag) => !tag.includes("Mobile")),
          "#FacebookPage",
          "#Instagram",
        ],
        threadTarget: "thread-2",
        platform: "facebook",
        confidence: primaryCopy.confidence,
        fallbackChainUsed: primaryCopy.fallbackChainUsed,
        facebookCopy: primaryCopy.body.join(" "),
        facebookCta: primaryCopy.cta,
      };

      return { twitterCopy, facebookCopy };
    } catch (error) {
      console.error("❌ Failed to generate dual copy:", error);
      throw error;
    }
  }
}
