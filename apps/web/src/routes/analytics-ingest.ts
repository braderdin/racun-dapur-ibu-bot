"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DualBuyClickEvent } from "../types/catalog";

// 🔐 Validate API key
function validateApiKey(request: NextRequest): boolean {
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const validApiKey = process.env.API_KEY;

  return !validApiKey || apiKey === validApiKey;
}

// Zod schema for event validation
const EventSchema = z.object({
  event_type: z.string(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  data: z.record(z.any()).default({}),
  timestamp: z.string().optional(),
  source: z.string().default("web-portal"),
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 📊 Click analytics ingestion endpoint
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = EventSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "Invalid event data",
          details: validationResult.error.errors
            .map((err) => `${err.path.join(".")}: ${err.message}`)
            .join(", "),
        },
        { status: 400 },
      );
    }

    const event = validationResult.data;

    // Create analytics record
    const analyticsRecord = {
      event_type: event.event_type,
      user_id: event.user_id,
      session_id:
        event.session_id ||
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: event.data,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
      processed_at: new Date().toISOString(),
      batch_id: `batch_${Date.now()}`, // Group related events
    };

    // Insert into analytics table
    const { data: insertedRecord, error } = await supabase
      .from("analytics_events")
      .insert([analyticsRecord])
      .select()
      .single();

    if (error) {
      console.error("Failed to insert analytics event:", error);
      return NextResponse.json(
        {
          error: "Database error",
          message: "Failed to store analytics event",
          details: error.message,
        },
        { status: 500 },
      );
    }

    // Process special event types
    if (event.event_type === "dual_buy_click") {
      await processDualBuyClickEvent(
        event.data as DualBuyClickEvent,
        analyticsRecord.batch_id,
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { id: insertedRecord.id, batch_id: analyticsRecord.batch_id },
        message: "Analytics event ingested successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in analytics ingestion:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process analytics event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// 🎯 Process dual buy click event
async function processDualBuyClickEvent(
  clickEvent: DualBuyClickEvent,
  batchId: string,
): Promise<void> {
  try {
    const {
      productId,
      platform,
      affiliateCode,
      timestamp,
      userAgent,
      referrer,
      sessionId,
      ipAddress,
    } = clickEvent;

    // Log to click_logs table for analytics
    const clickRecord = {
      product_id: productId,
      platform,
      affiliate_code: affiliateCode,
      timestamp: timestamp || new Date().toISOString(),
      user_agent: userAgent,
      referrer,
      session_id: sessionId,
      ip_address: ipAddress,
      processed_batch: batchId,
      conversion: false, // Will be updated when conversion happens
    };

    const { error } = await supabase.from("click_logs").insert([clickRecord]);

    if (error) {
      console.error("Failed to log dual buy click:", error);
      // Don't fail the entire request - just log the error
    }

    // Update product click count
    await updateProductClickCount(productId);

    // Trigger real-time broadcast if this is a significant event
    if (productId && Math.random() < 0.1) {
      // Simulate 10% chance for promotion
      await broadcastPromotionEvent(productId, platform, clickRecord);
    }
  } catch (error) {
    console.error("Error processing dual buy click:", error);
  }
}

// 🔄 Update product click count
async function updateProductClickCount(productId: string): Promise<void> {
  try {
    // Use Supabase RPC for atomic increment
    const { error } = await supabase.rpc("increment_total_clicks", {
      product_id: productId,
    });

    if (error) {
      console.error("Failed to increment click count:", error);
      // Fallback to direct update
      await supabase
        .from("posted_products")
        .update({ total_clicks: supabase.raw("total_clicks + 1") })
        .eq("id", productId);
    }
  } catch (error) {
    console.error("Error updating product click count:", error);
  }
}

// 📢 Broadcast promotion event for special clicks
async function broadcastPromotionEvent(
  productId: string,
  platform: "lazada" | "shopee",
  clickRecord: any,
): Promise<void> {
  try {
    // This would trigger real-time notifications
    // For now, just log for audit trail
    const promotionEvent = {
      type: "promotion",
      productId,
      platform,
      clickRecord,
      message: `New deal alert: ${platform === "lazada" ? "Lazada" : "Shopee"} flash sale!`,
      timestamp: new Date().toISOString(),
      batch_id: clickRecord.processed_batch,
    };

    // Optional: Send to queue for processing
    // await supabase.from('promotion_queue').insert([promotionEvent]);

    console.log("Promotion event queued:", promotionEvent);
  } catch (error) {
    console.error("Error broadcasting promotion:", error);
  }
}

// 📊 Batch process multiple events
export async function BATCH_POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        {
          error: "Invalid batch",
          message: "Request body must be an array of events",
        },
        { status: 400 },
      );
    }

    const batchId = `batch_${Date.now()}`;
    const events = body.map((event) => ({
      ...event,
      source: event.source || "web-portal-batch",
    }));

    // Validate all events first
    const validationResults = events.map((event) => {
      return EventSchema.safeParse(event);
    });

    const invalidEvents = validationResults.filter((result) => !result.success);
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "Some events in batch are invalid",
          details: invalidEvents
            .flatMap((result, index) =>
              result.error.errors.map(
                (err) =>
                  `Event ${index + 1}: ${err.path.join(".")}: ${err.message}`,
              ),
            )
            .join(", "),
        },
        { status: 400 },
      );
    }

    // Insert all valid events
    const analyticsRecords = events.map((event) => ({
      event_type: event.event_type,
      user_id: event.user_id,
      session_id: event.session_id,
      data: event.data,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source,
      processed_at: new Date().toISOString(),
      batch_id: batchId,
    }));

    const { data, error } = await supabase
      .from("analytics_events")
      .insert(analyticsRecords)
      .select("id");

    if (error) {
      return NextResponse.json(
        {
          error: "Database error",
          message: "Failed to insert batch events",
          details: error.message,
        },
        { status: 500 },
      );
    }

    // Process dual buy clicks in batch
    const dualBuyEvents = events.filter(
      (event) => event.event_type === "dual_buy_click",
    );
    if (dualBuyEvents.length > 0) {
      await Promise.all(
        dualBuyEvents.map((event) =>
          processDualBuyClickEvent(event.data as DualBuyClickEvent, batchId),
        ),
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          batch_id: batchId,
          processed_count: data.length,
          total_count: events.length,
          ids: data.map((record) => record.id),
        },
        message: `Successfully processed ${data.length} events in batch`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in batch analytics:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process batch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// 📋 Get analytics health check
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const hours = searchParams.get("hours")
      ? parseInt(searchParams.get("hours")!)
      : 24;

    // Get event counts for last N hours
    const startTime = new Date(
      Date.now() - hours * 60 * 60 * 1000,
    ).toISOString();

    const { data: events, error } = await supabase
      .from("analytics_events")
      .select("event_type, source, timestamp")
      .gte("timestamp", startTime)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Failed to get analytics:", error);
      throw error;
    }

    // Calculate metrics
    const eventCounts = events.reduce((acc: any, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {});

    const sourceCounts = events.reduce((acc: any, event) => {
      acc[event.source] = (acc[event.source] || 0) + 1;
      return acc;
    }, {});

    const metrics = {
      totalEvents: events.length,
      eventTypes: eventCounts,
      sources: sourceCounts,
      timeRange: {
        start: startTime,
        end: new Date().toISOString(),
        hours,
      },
      latestEvent: events[0]?.timestamp || null,
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in analytics GET:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to retrieve analytics metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// 🔄 Handle CORS
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Restrict in production
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}
