/*
 * Supabase Realtime Conversion Event Dispatcher
 * Broadcasts live deal alerts, flash sale triggers, and trending
 * item badges to the Vercel Web Portal via Supabase Realtime
 * WebSocket channels.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";
import { ProductItem } from "../types/product";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type RealtimeEventType =
  | "DEAL_ALERT"
  | "FLASH_SALE_TRIGGER"
  | "TRENDING_BADGE"
  | "PRICE_DROP"
  | "DEAL_CURATED";

export interface RealtimeEventPayload {
  eventType: RealtimeEventType;
  productId: string;
  productName: string;
  platform: "lazada" | "shopee";
  price: number;
  discountPercent: number;
  imageUrl: string;
  affiliateUrl: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RealtimeBroadcastConfig {
  channelName: string;
  maxQueueSize: number;
  flushIntervalMs: number;
  enableCompression: boolean;
}

export interface NotifierStats {
  totalBroadcasts: number;
  eventsPerType: Record<RealtimeEventType, number>;
  averageLatencyMs: number;
  lastBroadcastAt: string;
  activeChannels: number;
}

export interface FlashSaleTrigger {
  productId: string;
  productName: string;
  flashSaleEnd: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  urgencyLevel: "medium" | "high" | "critical";
}

export interface TrendingBadge {
  productId: string;
  productName: string;
  trendScore: number;
  rank: number;
  category: string;
  badgeType: "trending" | "all-time-low" | "flash-sale" | "top-rated";
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RealtimeBroadcastConfig = {
  channelName: "deal-alerts",
  maxQueueSize: 100,
  flushIntervalMs: 1000,
  enableCompression: true,
};

// ---------------------------------------------------------------------------
// Realtime Notifier Service
// ---------------------------------------------------------------------------

export class RealtimeNotifier {
  private config: RealtimeBroadcastConfig;
  private env: Env;
  private eventQueue: RealtimeEventPayload[] = [];
  private stats: NotifierStats;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(env: Env, config?: Partial<RealtimeBroadcastConfig>) {
    this.env = env;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
    this.supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    this.stats = {
      totalBroadcasts: 0,
      eventsPerType: {
        DEAL_ALERT: 0,
        FLASH_SALE_TRIGGER: 0,
        TRENDING_BADGE: 0,
        PRICE_DROP: 0,
        DEAL_CURATED: 0,
      },
      averageLatencyMs: 0,
      lastBroadcastAt: "",
      activeChannels: 0,
    };

    logger.info(
      "RealtimeNotifier initialized",
      {
        channelName: this.config.channelName,
        flushIntervalMs: this.config.flushIntervalMs,
      },
      "RealtimeNotifier",
    );
  }

  // -----------------------------------------------------------------------
  // Start the notifier (begin flush cycle)
  // -----------------------------------------------------------------------

  start(): void {
    if (this.flushTimer) {
      logger.warn("RealtimeNotifier already running", {}, "RealtimeNotifier");
      return;
    }

    this.flushTimer = setInterval(
      () => this.flushQueue(),
      this.config.flushIntervalMs,
    );

    logger.info(
      "RealtimeNotifier started",
      {
        flushIntervalMs: this.config.flushIntervalMs,
      },
      "RealtimeNotifier",
    );
  }

  // -----------------------------------------------------------------------
  // Stop the notifier
  // -----------------------------------------------------------------------

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      logger.info("RealtimeNotifier stopped", {}, "RealtimeNotifier");
    }
  }

  // -----------------------------------------------------------------------
  // Queue a deal alert event
  // -----------------------------------------------------------------------

  async queueDealAlert(
    product: ProductItem,
    discountPercent: number,
  ): Promise<void> {
    const payload: RealtimeEventPayload = {
      eventType: "DEAL_ALERT",
      productId: product.id,
      productName: product.title,
      platform: this.inferPlatform(product),
      price: this.parsePrice(product.price),
      discountPercent,
      imageUrl: product.imageUrl,
      affiliateUrl: product.affiliateUrl,
      timestamp: new Date().toISOString(),
    };

    this.enqueueEvent(payload);
  }

  // -----------------------------------------------------------------------
  // Queue a flash sale trigger event
  // -----------------------------------------------------------------------

  async queueFlashSaleTrigger(trigger: FlashSaleTrigger): Promise<void> {
    const payload: RealtimeEventPayload = {
      eventType: "FLASH_SALE_TRIGGER",
      productId: trigger.productId,
      productName: trigger.productName,
      platform: "lazada",
      price: trigger.currentPrice,
      discountPercent: trigger.discountPercent,
      imageUrl: "",
      affiliateUrl: "",
      timestamp: new Date().toISOString(),
      metadata: {
        flashSaleEnd: trigger.flashSaleEnd,
        urgencyLevel: trigger.urgencyLevel,
        originalPrice: trigger.originalPrice,
      },
    };

    this.enqueueEvent(payload);
  }

  // -----------------------------------------------------------------------
  // Queue a trending badge event
  // -----------------------------------------------------------------------

  async queueTrendingBadge(badge: TrendingBadge): Promise<void> {
    const payload: RealtimeEventPayload = {
      eventType: "TRENDING_BADGE",
      productId: badge.productId,
      productName: badge.productName,
      platform: "lazada",
      price: 0,
      discountPercent: 0,
      imageUrl: "",
      affiliateUrl: "",
      timestamp: new Date().toISOString(),
      metadata: {
        trendScore: badge.trendScore,
        rank: badge.rank,
        category: badge.category,
        badgeType: badge.badgeType,
      },
    };

    this.enqueueEvent(payload);
  }

  // -----------------------------------------------------------------------
  // Queue a price drop notification
  // -----------------------------------------------------------------------

  async queuePriceDrop(
    product: ProductItem,
    oldPrice: number,
    newPrice: number,
  ): Promise<void> {
    const dropPercent =
      oldPrice > 0 ? ((oldPrice - newPrice) / oldPrice) * 100 : 0;

    const payload: RealtimeEventPayload = {
      eventType: "PRICE_DROP",
      productId: product.id,
      productName: product.title,
      platform: this.inferPlatform(product),
      price: newPrice,
      discountPercent: dropPercent,
      imageUrl: product.imageUrl,
      affiliateUrl: product.affiliateUrl,
      timestamp: new Date().toISOString(),
      metadata: {
        oldPrice,
        priceDropPercent: Math.round(dropPercent * 100) / 100,
      },
    };

    this.enqueueEvent(payload);
  }

  // -----------------------------------------------------------------------
  // Queue a curated deal notification
  // -----------------------------------------------------------------------

  async queueCuratedDeal(
    product: ProductItem,
    score: number,
    reasons: string[],
  ): Promise<void> {
    const payload: RealtimeEventPayload = {
      eventType: "DEAL_CURATED",
      productId: product.id,
      productName: product.title,
      platform: this.inferPlatform(product),
      price: this.parsePrice(product.price),
      discountPercent: this.parseDiscount(product.discountRate),
      imageUrl: product.imageUrl,
      affiliateUrl: product.affiliateUrl,
      timestamp: new Date().toISOString(),
      metadata: {
        curationScore: score,
        reasons,
      },
    };

    this.enqueueEvent(payload);
  }

  // -----------------------------------------------------------------------
  // Flush the event queue (broadcast all pending events)
  // -----------------------------------------------------------------------

  async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    const startTime = Date.now();

    try {
      // Broadcast each event to the Supabase Realtime channel
      for (const event of eventsToSend) {
        await this.broadcastEvent(event);
        this.stats.eventsPerType[event.eventType]++;
        this.stats.totalBroadcasts++;
      }

      const latency = Date.now() - startTime;
      this.stats.averageLatencyMs =
        (this.stats.averageLatencyMs * (this.stats.totalBroadcasts - 1) +
          latency) /
        this.stats.totalBroadcasts;
      this.stats.lastBroadcastAt = new Date().toISOString();

      logger.info(
        "Event queue flushed",
        {
          eventCount: eventsToSend.length,
          latencyMs: latency,
        },
        "RealtimeNotifier",
      );
    } catch (error) {
      logger.error(
        "Failed to flush event queue",
        {
          error: error instanceof Error ? error.message : String(error),
          queuedEvents: eventsToSend.length,
        },
        "RealtimeNotifier",
      );

      // Re-queue failed events
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  // -----------------------------------------------------------------------
  // Get current stats
  // -----------------------------------------------------------------------

  getStats(): NotifierStats {
    return { ...this.stats };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private enqueueEvent(payload: RealtimeEventPayload): void {
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      logger.warn(
        "Event queue full — dropping oldest event",
        {
          queueSize: this.eventQueue.length,
        },
        "RealtimeNotifier",
      );
      this.eventQueue.shift();
    }
    this.eventQueue.push(payload);
  }

  private async broadcastEvent(event: RealtimeEventPayload): Promise<void> {
    // In production, this uses Supabase Realtime via the Supabase JS client
    // For the Cloudflare Worker context, we use the Supabase REST API
    // to trigger Realtime broadcasts via database inserts

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/realtime_events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
          },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.warn(
        "Realtime broadcast failed, queuing for retry",
        {
          error: error instanceof Error ? error.message : String(error),
          eventType: event.eventType,
        },
        "RealtimeNotifier",
      );
      throw error;
    }
  }

  private inferPlatform(product: ProductItem): "lazada" | "shopee" {
    const url = product.affiliateUrl.toLowerCase();
    if (url.includes("lazada")) return "lazada";
    if (url.includes("shopee")) return "shopee";
    return "lazada";
  }

  private parsePrice(priceStr?: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  private parseDiscount(discountStr?: string): number {
    if (!discountStr) return 0;
    const cleaned = discountStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createRealtimeNotifier(env: Env): RealtimeNotifier {
  return new RealtimeNotifier(env, {
    channelName: env.REALTIME_CHANNEL || "deal-alerts",
    flushIntervalMs: parseInt(env.REALTIME_FLUSH_MS || "1000", 10),
    maxQueueSize: parseInt(env.REALTIME_MAX_QUEUE || "100", 10),
  });
}
