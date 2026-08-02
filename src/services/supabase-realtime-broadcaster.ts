/*
 * Supabase Realtime Broadcaster Service
 * Dispatches real-time WebSocket broadcast events to the Vercel Web Portal
 * whenever a new deal or flash sale is curated by the bot.
 */

import { Env } from "../types/env";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealtimeEvent {
  type:
    | "deal_curated"
    | "flash_sale"
    | "post_published"
    | "error"
    | "health_update";
  payload: Record<string, any>;
  timestamp: string;
  channel?: string;
}

export interface DealCuratedPayload {
  dealId: string;
  productId: string;
  title: string;
  price: number;
  discountPrice: number;
  discountPercent: number;
  platform: "lazada" | "shopee";
  affiliateLink: string;
  imageUrls: string[];
  category: string;
  rating: number;
  stock: number;
}

export interface FlashSalePayload {
  dealId: string;
  productId: string;
  title: string;
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  endTime: string;
  platform: "lazada" | "shopee";
  affiliateLink: string;
}

export interface PostPublishedPayload {
  postId: string;
  platform: "x" | "facebook";
  dealId: string;
  content: string;
  imageUrl: string;
  affiliateLink: string;
  publishedAt: string;
}

export interface HealthUpdatePayload {
  status: "healthy" | "degraded" | "unhealthy";
  services: Record<string, { status: "up" | "down"; latencyMs?: number }>;
  metrics: {
    totalDeals: number;
    totalPosts: number;
    totalClicks: number;
    uptimeSeconds: number;
  };
}

export interface BroadcastResult {
  success: boolean;
  eventId: string;
  channel: string;
  timestamp: string;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Supabase Realtime Broadcaster Service
// ---------------------------------------------------------------------------

export class SupabaseRealtimeBroadcaster {
  private env: Env;
  private baseUrl: string;
  private serviceKey: string;
  private readonly BROADCAST_TIMEOUT_MS = 5000;

  constructor(env: Env) {
    this.env = env;
    this.baseUrl = env.SUPABASE_URL || "";
    this.serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  }

  // ---------------------------------------------------------------------------
  // Broadcast event to all connected clients
  // ---------------------------------------------------------------------------

  async broadcast(event: RealtimeEvent): Promise<BroadcastResult> {
    const startTime = Date.now();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      if (!this.baseUrl || !this.serviceKey) {
        throw new Error("Supabase not configured");
      }

      const payload = {
        event_id: eventId,
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      };

      const response = await fetch(
        `${this.baseUrl}/functions/v1/realtime-broadcast`,
        {
          method: "POST",
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "Realtime broadcast failed",
          {
            eventId,
            status: response.status,
            error: errorText,
          },
          "SupabaseRealtimeBroadcaster",
        );

        return {
          success: false,
          eventId,
          channel: event.channel || "default",
          timestamp: new Date().toISOString(),
          latencyMs: latency,
          error: errorText,
        };
      }

      logger.info(
        "Realtime broadcast sent",
        {
          eventId,
          type: event.type,
          channel: event.channel || "default",
          latencyMs: latency,
        },
        "SupabaseRealtimeBroadcaster",
      );

      return {
        success: true,
        eventId,
        channel: event.channel || "default",
        timestamp: new Date().toISOString(),
        latencyMs: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error(
        "Realtime broadcast error",
        {
          eventId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "SupabaseRealtimeBroadcaster",
      );

      return {
        success: false,
        eventId,
        channel: event.channel || "default",
        timestamp: new Date().toISOString(),
        latencyMs: latency,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast deal curated event
  // ---------------------------------------------------------------------------

  async broadcastDealCurated(
    deal: DealCuratedPayload,
  ): Promise<BroadcastResult> {
    return this.broadcast({
      type: "deal_curated",
      payload: deal,
      timestamp: new Date().toISOString(),
      channel: "deals",
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast flash sale event
  // ---------------------------------------------------------------------------

  async broadcastFlashSale(sale: FlashSalePayload): Promise<BroadcastResult> {
    return this.broadcast({
      type: "flash_sale",
      payload: sale,
      timestamp: new Date().toISOString(),
      channel: "flash_sales",
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast post published event
  // ---------------------------------------------------------------------------

  async broadcastPostPublished(
    post: PostPublishedPayload,
  ): Promise<BroadcastResult> {
    return this.broadcast({
      type: "post_published",
      payload: post,
      timestamp: new Date().toISOString(),
      channel: "posts",
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast health update event
  // ---------------------------------------------------------------------------

  async broadcastHealthUpdate(
    health: HealthUpdatePayload,
  ): Promise<BroadcastResult> {
    return this.broadcast({
      type: "health_update",
      payload: health,
      timestamp: new Date().toISOString(),
      channel: "health",
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast error event
  // ---------------------------------------------------------------------------

  async broadcastError(error: {
    errorId: string;
    message: string;
    service: string;
    severity: "low" | "medium" | "high" | "critical";
    context?: Record<string, any>;
  }): Promise<BroadcastResult> {
    return this.broadcast({
      type: "error",
      payload: error,
      timestamp: new Date().toISOString(),
      channel: "errors",
    });
  }

  // ---------------------------------------------------------------------------
  // Subscribe to events (for Vercel portal)
  // ---------------------------------------------------------------------------

  async subscribe(
    channel: string,
    callback: (event: RealtimeEvent) => void,
  ): Promise<() => void> {
    // This would typically use Supabase Realtime WebSocket client
    // For now, we provide a placeholder for the Vercel portal to implement
    logger.info(
      "Subscribing to realtime channel",
      { channel },
      "SupabaseRealtimeBroadcaster",
    );

    // Return unsubscribe function
    return () => {
      logger.info(
        "Unsubscribed from realtime channel",
        { channel },
        "SupabaseRealtimeBroadcaster",
      );
    };
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    latencyMs: number;
    timestamp: string;
  }> {
    const startTime = Date.now();

    try {
      if (!this.baseUrl || !this.serviceKey) {
        return {
          status: "unhealthy",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Simple connectivity check
      const response = await fetch(`${this.baseUrl}/rest/v1/`, {
        method: "GET",
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });

      const latency = Date.now() - startTime;
      const status = response.ok ? "healthy" : "degraded";

      return {
        status,
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let broadcasterInstance: SupabaseRealtimeBroadcaster | null = null;

export function getRealtimeBroadcaster(env: Env): SupabaseRealtimeBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new SupabaseRealtimeBroadcaster(env);
  }
  return broadcasterInstance;
}
