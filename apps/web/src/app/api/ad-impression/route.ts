import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

// ---------------------------------------------------------------------------
// Edge Ad Impression & Click Analytics Route
// Logs ad impressions and click events to Upstash Redis batch buffer
// before flushing to Supabase to save DB compute cycles.
// Target: < 10ms response latency for analytics.
// ---------------------------------------------------------------------------

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Batch buffer configuration
const BATCH_BUFFER_KEY = "ad_analytics_batch";
const BATCH_FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_BATCH_SIZE = 100; // Max events per batch

interface AdEvent {
  event_type: "impression" | "click";
  deal_id: string;
  platform: "web" | "x" | "facebook";
  ip_address: string;
  user_agent: string;
  referer: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface AdPerformanceMetrics {
  deal_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
  last_updated: string;
}

// ---------------------------------------------------------------------------
// POST /api/ad-impression — Log ad impression or click event
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate required fields
    const { eventType, dealId, platform, metadata } = body;

    if (!eventType || !dealId || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, dealId, platform" },
        { status: 400 },
      );
    }

    if (!["impression", "click"].includes(eventType)) {
      return NextResponse.json(
        { error: "Invalid eventType. Must be 'impression' or 'click'" },
        { status: 400 },
      );
    }

    if (!["web", "x", "facebook"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be 'web', 'x', or 'facebook'" },
        { status: 400 },
      );
    }

    const event: AdEvent = {
      event_type: eventType,
      deal_id: dealId,
      platform,
      ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
      referer: request.headers.get("referer") || "",
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    };

    // Add to Redis batch buffer
    await addToBatchBuffer(event);

    // Check if batch should be flushed
    const batchSize = await redis.llen(BATCH_BUFFER_KEY);
    if (batchSize >= MAX_BATCH_SIZE) {
      flushBatchToSupabase().catch(() => {});
    }

    const latency = Date.now() - startTime;
    console.log(
      `[ad-analytics] ${eventType} logged for ${dealId} (${latency}ms)`,
    );

    return NextResponse.json({
      success: true,
      event_type: eventType,
      deal_id: dealId,
      latency_ms: latency,
    });
  } catch (error) {
    console.error("[ad-analytics] Error processing event:", error);
    return NextResponse.json(
      { error: "Failed to process ad event" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/ad-impression — Get ad performance metrics
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("deal_id");
    const platform = searchParams.get("platform");
    const days = parseInt(searchParams.get("days") || "7", 10);

    // Build query
    let query = supabase
      .from("ad_performance_metrics")
      .select("*")
      .gte(
        "last_updated",
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      );

    if (dealId) {
      query = query.eq("deal_id", dealId);
    }

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query
      .order("impressions", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[ad-analytics] Error fetching metrics:", error);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 },
      );
    }

    const latency = Date.now() - startTime;
    console.log(`[ad-analytics] Metrics fetched (${latency}ms)`);

    return NextResponse.json({
      success: true,
      metrics: data || [],
      latency_ms: latency,
    });
  } catch (error) {
    console.error("[ad-analytics] Error fetching metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch ad metrics" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: Add event to Redis batch buffer
// ---------------------------------------------------------------------------

async function addToBatchBuffer(event: AdEvent): Promise<void> {
  try {
    await redis.lpush(BATCH_BUFFER_KEY, JSON.stringify(event));
    // Set TTL to ensure batch doesn't grow indefinitely
    await redis.expire(BATCH_BUFFER_KEY, 3600); // 1 hour TTL
  } catch (error) {
    console.error("[ad-analytics] Failed to add to batch buffer:", error);
    // Fallback: write directly to Supabase
    await writeToSupabase(event);
  }
}

// ---------------------------------------------------------------------------
// Helper: Flush batch buffer to Supabase
// ---------------------------------------------------------------------------

async function flushBatchToSupabase(): Promise<void> {
  try {
    // Get all events from batch
    const events = await redis.lrange(BATCH_BUFFER_KEY, 0, -1);

    if (!events || events.length === 0) {
      return;
    }

    // Parse events
    const parsedEvents: AdEvent[] = events.map((e) => JSON.parse(e));

    // Write to Supabase
    const { error } = await supabase.from("ad_events").insert(parsedEvents);

    if (error) {
      console.error("[ad-analytics] Batch insert failed:", error);
      return;
    }

    // Clear batch buffer
    await redis.del(BATCH_BUFFER_KEY);

    // Update performance metrics
    await updatePerformanceMetrics(parsedEvents);

    console.log(
      `[ad-analytics] Flushed ${parsedEvents.length} events to Supabase`,
    );
  } catch (error) {
    console.error("[ad-analytics] Batch flush failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Helper: Write single event to Supabase (fallback)
// ---------------------------------------------------------------------------

async function writeToSupabase(event: AdEvent): Promise<void> {
  try {
    await supabase.from("ad_events").insert(event);
  } catch (error) {
    console.error("[ad-analytics] Direct write failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Helper: Update ad performance metrics
// ---------------------------------------------------------------------------

async function updatePerformanceMetrics(events: AdEvent[]): Promise<void> {
  try {
    // Group events by deal_id
    const metrics: Record<string, { impressions: number; clicks: number }> = {};

    for (const event of events) {
      if (!metrics[event.deal_id]) {
        metrics[event.deal_id] = { impressions: 0, clicks: 0 };
      }

      if (event.event_type === "impression") {
        metrics[event.deal_id].impressions++;
      } else if (event.event_type === "click") {
        metrics[event.deal_id].clicks++;
      }
    }

    // Update or insert metrics
    for (const [dealId, counts] of Object.entries(metrics)) {
      const ctr =
        counts.impressions > 0 ? counts.clicks / counts.impressions : 0;

      await supabase.from("ad_performance_metrics").upsert({
        deal_id: dealId,
        impressions: counts.impressions,
        clicks: counts.clicks,
        ctr: ctr,
        last_updated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("[ad-analytics] Metrics update failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Config — force edge runtime for <10ms latency
// ---------------------------------------------------------------------------

export const config = {
  runtime: "edge",
};
