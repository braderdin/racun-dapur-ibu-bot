import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { env } from "@/config/env";

// ---------------------------------------------------------------------------
// Edge Shortlink Redirect — HTTP 302 via Upstash Redis Cache
// Logs click analytics to Supabase `link_clicks` asynchronously.
// Target: < 15ms redirect latency.
// ---------------------------------------------------------------------------

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

interface ShortlinkRow {
  short_code: string;
  target_url: string;
  platform: "lazada" | "shopee";
  product_id: string;
  enabled: boolean;
}

interface ClickLogPayload {
  short_code: string;
  target_url: string;
  ip_address: string;
  user_agent: string;
  referer: string;
  clicked_at: string;
  conversion_result: boolean;
}

// ---------------------------------------------------------------------------
// GET /r/[code] — Resolve shortlink, serve 302 redirect
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const startTime = Date.now();

  // 1. Check Redis cache first
  let cachedUrl: string | null = null;
  try {
    cachedUrl = (await redis.get(`shortlink:${code}`)) as string | null;
  } catch {
    // Redis unavailable — fall through to Supabase
  }

  if (cachedUrl) {
    // Cache hit — log analytics async, return immediately
    logClickAsync(code, cachedUrl, request).catch(() => {});
    return NextResponse.redirect(new URL(cachedUrl, request.url), 302);
  }

  // 2. Cache miss — resolve from Supabase
  const { data, error } = await supabase
    .from("shortlinks")
    .select("*")
    .eq("short_code", code)
    .eq("enabled", true)
    .single<ShortlinkRow>();

  if (error || !data) {
    return new NextResponse("Shortlink not found", { status: 404 });
  }

  // 3. Store in Redis cache for future requests (TTL: 1 hour)
  try {
    await redis.set(`shortlink:${code}`, data.target_url, {
      ex: 3600,
    });
  } catch {
    // Redis write failure is non-critical
  }

  // 4. Log click analytics asynchronously (non-blocking)
  logClickAsync(code, data.target_url, request).catch(() => {});

  // 5. Return HTTP 302 redirect
  const latency = Date.now() - startTime;
  console.log(`[shortlink] ${code} -> ${data.target_url} (${latency}ms)`);

  return NextResponse.redirect(new URL(data.target_url, request.url), 302);
}

// ---------------------------------------------------------------------------
// Async click logging — never blocks the redirect response
// ---------------------------------------------------------------------------

async function logClickAsync(
  shortCode: string,
  targetUrl: string,
  request: Request,
): Promise<void> {
  try {
    const payload: ClickLogPayload = {
      short_code: shortCode,
      target_url: targetUrl,
      ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
      referer: request.headers.get("referer") || "",
      clicked_at: new Date().toISOString(),
      conversion_result: false,
    };

    await supabase.from("link_clicks").insert(payload);
  } catch (error) {
    console.error("[shortlink] Click log failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Config — force edge runtime for <15ms latency
// ---------------------------------------------------------------------------

export const config = {
  runtime: "edge",
};
