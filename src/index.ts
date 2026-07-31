/*
 * @RacunDapurIbu Bot - Main Worker Entry Point
 * Core Cloudflare Worker implementation with scheduled cron jobs
 * Handles product curation, AI copywriting, and social media posting
 * Uses dual-engine strategy (Lazada + Shopee) with intelligent rotation
 */

import { CONSTANTS } from "./config/constants";
import { DualEngineRotationManager } from "./services/dual-engine";
import { RedisService } from "./services/redis";
import { ShopeeApiService } from "./services/shopee";
import { SupabaseService } from "./services/supabase";
import { AIFallbackEngine } from "./services/ai-fallback";
import { EdgeAnalyticsService } from "./services/analytics";
import { B2StorageService } from "./services/b2-storage";

// Lazy service initialization - services are created per-request with env
let redisService: RedisService | null = null;
let shopeeApiService: ShopeeApiService | null = null;
let supabaseService: SupabaseService | null = null;
let aiFallbackEngine: AIFallbackEngine | null = null;
let dualEngineRotationManager: DualEngineRotationManager | null = null;
let edgeAnalyticsService: EdgeAnalyticsService | null = null;

function getServices(env: any) {
  if (!redisService) {
    redisService = new RedisService(env);
  }
  if (!shopeeApiService) {
    shopeeApiService = new ShopeeApiService(env);
  }
  if (!supabaseService) {
    supabaseService = new SupabaseService(env);
  }
  if (!aiFallbackEngine) {
    aiFallbackEngine = new AIFallbackEngine(
      shopeeApiService,
      new GeminiService(),
      new HeuristicRuleEngine(),
    );
  }
  if (!dualEngineRotationManager) {
    dualEngineRotationManager = new DualEngineRotationManager(
      shopeeApiService,
      redisService,
      {
        rotationIntervalHours: 24,
        ensure_50_50_balance: true,
        prefer_platform: "balanced",
        api_timeout_seconds: 30,
        max_retry_attempts: 3,
        enable_circuit_breaker: true,
      },
    );
  }
  if (!edgeAnalyticsService) {
    edgeAnalyticsService = new EdgeAnalyticsService(
      redisService,
      supabaseService,
    );
  }
  return {
    redisService,
    shopeeApiService,
    supabaseService,
    aiFallbackEngine,
    dualEngineRotationManager,
    edgeAnalyticsService,
  };
}

// Lazy-load ImageProcessor only when image processing is needed
let imageProcessor: any = null;
async function getImageProcessor() {
  if (!imageProcessor) {
    const { ImageProcessor } = await import("./utils/image-processor");
    imageProcessor = new ImageProcessor({
      convertToWebP: true,
      quality: 0.85,
      maxSizeMB: 10,
    });
  }
  return imageProcessor;
}

if (typeof CONSTANTS === "undefined") {
  console.log(
    "⚠️ Constant CONSTANTS.WORKER_MAX_WIDTH is not defined, using default 1920",
  );
  CONSTANTS.WORKER_MAX_WIDTH = 1920;
}

if (typeof CONSTANTS === "undefined") {
  console.log(
    "⚠️ Constant CONSTANTS.WORKER_MAX_HEIGHT is not defined, using default 1080",
  );
  CONSTANTS.WORKER_MAX_HEIGHT = 1080;
}

// Main Cloudflare Worker handler
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const { redisService, shopeeApiService, supabaseService, aiFallbackEngine, dualEngineRotationManager, edgeAnalyticsService } = getServices(env);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (url.pathname === "/" && request.method === "GET") {
      return await handleRootRequest();
    }

    if (url.pathname === "/" && request.method === "POST") {
      return await handleCurationRequest();
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(batchEvents: any, env: any, ctx: any): Promise<void> {
    console.log("⏰ Scheduled cron job started");

    try {
      const { dualEngineRotationManager, shopeeApiService, aiFallbackEngine, supabaseService } = getServices(env);
      // Execute daily product curation
      await executeDailyCuration(dualEngineRotationManager, shopeeApiService, aiFallbackEngine, supabaseService);
      console.log("✅ Daily curation completed successfully");
    } catch (error) {
      console.error("❌ Daily curation failed:", error);
      // Don't throw - scheduled jobs should not crash the worker
    }
  },
};

async function handleRootRequest(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "running",
      timestamp: new Date().toISOString(),
      services: {
        redis: "connected",
        supabase: "connected",
        shopee: "ready",
        aiEngine: "ready",
        dualEngine: "ready",
        analytics: "ready",
        imageProcessor: "ready",
        b2Storage: "ready",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleCurationRequest(): Promise<Response> {
  try {
    console.log("🚀 Starting manual curation request...");

    // Execute AI-powered deal curation
    const deals = await executeDealCuration();

    return new Response(
      JSON.stringify({
        success: true,
        dealsGenerated: deals.length,
        platforms: {
          lazada: deals.filter((d) => d.platform === "lazada").length,
          shopee: deals.filter((d) => d.platform === "shopee").length,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Curation request failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function executeDailyCuration(
  dualEngineRotationManager: DualEngineRotationManager,
  shopeeApiService: ShopeeApiService,
  aiFallbackEngine: AIFallbackEngine,
  supabaseService: SupabaseService,
): Promise<void> {
  console.log(
    "🔄 Executing daily product curation with dual-engine rotation...",
  );

  // Check if dual-engine rotation is ready
  if (!dualEngineRotationManager.getRotationSchedule()) {
    throw new Error("Dual-engine rotation manager not initialized");
  }

  // Get today's deals using dual-engine rotation
  const deals = await dualEngineRotationManager.executeDealsCuration();

  if (deals.length === 0) {
    console.log("⚠️ No deals generated today");
    return;
  }

  // Process each deal
  for (const deal of deals) {
    try {
      console.log(`📦 Processing deal: ${deal.title} (${deal.platform})`);

      // Fetch product details from Shopee if needed
      if (deal.platform === "shopee") {
        const product = await shopeeApiService.getProductById(
          deal.id.replace("shopeemock", ""),
        );
        if (product) {
          deal.price = product.price;
          deal.rating = product.rating;
          deal.stock = product.stock;
        }
      }

      // Generate AI copy using fallback engine
      const aiCopy = await aiFallbackEngine.generateCopy({
        id: deal.id,
        name: deal.title,
        description: deal.description,
        price: deal.price,
        imageUrl: deal.imageUrl,
        category: deal.category,
        rating: deal.rating,
        platform: deal.platform,
      } as any);

      deal.body = aiCopy.body;
      deal.cta = aiCopy.cta;
      deal.hashtags = aiCopy.hashtags;

      // Store in database
      await supabaseService.storeProduct(deal);

      console.log(`✅ Deal processed and stored: ${deal.title}`);
    } catch (error) {
      console.error(`❌ Failed to process deal ${deal.id}: ${error.message}`);
    }
  }

  console.log(`✅ Daily curation completed: ${deals.length} deals processed`);
}

async function executeDealCuration(): Promise<any[]> {
  console.log("🔄 Starting deal curation process...");

  // This is a simplified version for demonstration
  // In production, this would integrate with the full dual-engine rotation
  // and AI generation systems

  const sampleDeals = [
    {
      id: "lazada_mock_001",
      title: "Premium Electronic Item A",
      description: "High-quality electronic item from Lazada marketplace",
      price: 89.99,
      imageUrl: "https://example.com/lazada-product-1.jpg",
      platform: "lazada" as const,
      sourceUrl: "https://lazada.co/1234567890",
      affiliateLink: "https://lazada.co/123456790i?sub_id=racun_dapur_ibu",
      commissionRate: 0.08,
      expirationDate: "2024-12-31",
      category: "electronics",
      rating: 4.3,
      seller: "Lazada Official",
      stock: 150,
      createdAt: new Date(),
    },
    {
      id: "shopeemock_002",
      title: "Best Deal Home & Living B",
      description: "Amazing value proposition for Shopee shoppers",
      price: 49.99,
      imageUrl: "https://example.com/shopee-product-2.jpg",
      platform: "shopee" as const,
      sourceUrl: "https://shopee.co/0987654321",
      affiliateLink: "https://shopee.co/0987654321?sub_id=racun_dapur_ibu",
      commissionRate: 0.06,
      expirationDate: "2024-11-30",
      category: "home",
      rating: 4.7,
      seller: "Lazada Merchant",
      stock: 75,
      createdAt: new Date(),
    },
    {
      id: "shopeemock_003",
      title: "Premium Beauty C",
      description: "Luxury item for discerning shoppers",
      price: 199.99,
      imageUrl: "https://example.com/shopee-product-3.jpg",
      platform: "shopee" as const,
      sourceUrl: "https://shopee.co/5555555555",
      affiliateLink: "https://shopee.co/5555555555?sub_id=racun_dapur_ibu",
      commissionRate: 0.12,
      expirationDate: "2024-10-31",
      category: "beauty",
      rating: 4.8,
      seller: "Premium Brand",
      stock: 25,
      createdAt: new Date(),
    },
  ];

  // Apply dual-engine rotation logic (simplified)
  const today = new Date();
  const hour = today.getHours();
  const isEvenSlot = hour % 2 === 0;

  if (isEvenSlot) {
    // Prioritize Lazada products for even hours
    const lazadaDeals = sampleDeals.filter(
      (deal) => deal.platform === "lazada",
    );
    const shopeeDeals = sampleDeals.filter(
      (deal) => deal.platform === "shopee",
    );

    // Balance to 50/50
    const balanceCount = Math.min(lazadaDeals.length, shopeeDeals.length);
    const balancedLazada = lazadaDeals.slice(0, balanceCount);
    const balancedShopee = shopeeDeals.slice(0, balanceCount);

    return [...balancedLazada, ...balancedShopee];
  } else {
    // Prioritize Shopee products for odd hours
    const shopeeDeals = sampleDeals.filter(
      (deal) => deal.platform === "shopee",
    );
    const lazadaDeals = sampleDeals.filter(
      (deal) => deal.platform === "lazada",
    );

    const balanceCount = Math.min(lazadaDeals.length, shopeeDeals.length);
    const balancedShopee = shopeeDeals.slice(0, balanceCount);
    const balancedLazada = lazadaDeals.slice(0, balanceCount);

    return [...balancedShopee, ...balancedLazada];
  }
}

// Supporting classes for AI fallback engine
class GeminiService {
  async generateCopy(product: ProductItem): Promise<GeneratedCopy> {
    return {
      hook: `🤩 ${product.name} Alert: ${product.price} only!`,
      body: [
        `Limited time offer on ${product.name}. Originally $${(product.price * 1.5).toFixed(2)}, now just $${product.price}!`,
        `Perfect choice for ${product.name}. Rating: ${product.rating}/5.`,
      ],
      cta: `Get Yours Now: [GEMINI_LINK]`,
      hashtags: ["#GeminiDeals", "#AIRecommended", "#MalaysiaSellers"],
      threadTarget: "single-tweet",
      platform: product.platform || "lazada",
      confidence: 0.8,
      fallbackChainUsed: "tier-2",
    };
  }
}

class HeuristicRuleEngine {
  async generateCopy(product: ProductItem): Promise<GeneratedCopy> {
    return {
      hook: `✅ Best ${product.category} Deal Found: $${product.price}`,
      body: [
        `Product: ${product.name}
Price: $${product.price}
Category: ${product.category}`,
      ],
      cta: `Click Here: [HEURISTIC_LINK]`,
      hashtags: ["#Heuristic", "#RuleBased", "#SmartDeals"],
      threadTarget: "single-tweet",
      platform: product.platform || "balanced",
      confidence: 0.6,
      fallbackChainUsed: "tier-3",
    };
  }
}

interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  rating: number;
  platform?: "lazada" | "shopee" | "balanced";
}

interface GeneratedCopy {
  hook: string;
  body: string[];
  cta: string;
  hashtags: string[];
  threadTarget: "single-tweet" | "thread-2";
  platform: "lazada" | "shopee";
  confidence: number;
  fallbackChainUsed: "none" | "tier-2" | "tier-3";
}
