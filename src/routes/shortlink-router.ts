/*
 * Custom Shortlink Domain Router & Click Tracking Service
 * Phase 6: Custom shortlink router for racun.ibu.my with affiliate redirects
 * Handles redirects like racun.ibu.my/airfryer -> affiliate URLs while logging metadata
 */

import { Env } from "../types/env";
import { logger } from "../utils/logger";

export interface ShortlinkRoute {
  id: string;
  shortCode: string;
  originalUrl: string;
  affiliateUrl: string;
  productName: string;
  platform: "lazada" | "shopee";
  category: string;
  enabled: boolean;
  createdAt: string;
  clickCount: number;
}

export interface ClickTrackingData {
  shortCode: string;
  source?: string;
  userAgent?: string;
  ipAddress?: string;
  refererUrl?: string;
  timestamp?: string;
  geoLocation?: {
    country: string;
    region: string;
    city: string;
  };
}

export class ShortlinkRouter {
  private routes: Map<string, ShortlinkRoute>;
  private clickTracker: ClickTracker;

  constructor(env: Env) {
    this.routes = new Map();
    this.clickTracker = new ClickTracker(env);

    this.initializeDefaultRoutes();
  }

  private initializeDefaultRoutes(): void {
    // Initialize with common product categories for Malaysian market
    const defaultRoutes: ShortlinkRoute[] = [
      {
        id: "route-lk-001",
        shortCode: "airfryer",
        originalUrl: "https://www.lazada.com.my/products/airfryer-malaysia",
        affiliateUrl: "https://racun.ibu.my/airfryer",
        productName: "Multi-Functional Air Fryer",
        platform: "lazada",
        category: "kitchen",
        enabled: true,
        createdAt: new Date().toISOString(),
        clickCount: 0,
      },
      {
        id: "route-lk-002",
        shortCode: "baby-stroller",
        originalUrl:
          "https://www.lazada.com.my/products/baby-stroller-malaysia",
        affiliateUrl: "https://racun.ibu.my/baby-stroller",
        productName: "Baby Stroller Double Seat",
        platform: "lazada",
        category: "baby",
        enabled: true,
        createdAt: new Date().toISOString(),
        clickCount: 0,
      },
      {
        id: "route-lk-003",
        shortCode: "skincare-set",
        originalUrl: "https://www.shopee.com.my/skincare-set-malaysia",
        affiliateUrl: "https://racun.ibu.my/skincare-set",
        productName: "Complete Skincare Set",
        platform: "shopee",
        category: "skincare",
        enabled: true,
        createdAt: new Date().toISOString(),
        clickCount: 0,
      },
      {
        id: "route-lk-004",
        shortCode: "gaming-chair",
        originalUrl: "https://www.shopee.com.my/gaming-chair-malaysia",
        affiliateUrl: "https://racun.ibu.my/gaming-chair",
        productName: "Ergonomic Gaming Chair",
        platform: "shopee",
        category: "gaming",
        enabled: true,
        createdAt: new Date().toISOString(),
        clickCount: 0,
      },
    ];

    for (const route of defaultRoutes) {
      this.routes.set(route.shortCode, route);
    }

    logger.info(
      "ShortlinkRouter initialized with default routes",
      {
        routeCount: defaultRoutes.length,
      },
      "ShortlinkRouter",
    );
  }

  public resolveShortlink(
    shortCode: string,
    clickData: Partial<ClickTrackingData> = {},
  ): {
    success: boolean;
    redirectUrl: string;
    originalUrl: string;
    error?: string;
  } {
    const route = this.routes.get(shortCode);

    if (!route) {
      const error = `Shortlink code '${shortCode}' not found or disabled`;
      logger.warn(error, { shortCode }, "ShortlinkRouter");
      return { success: false, redirectUrl: "", originalUrl: "", error };
    }

    if (!route.enabled) {
      const error = `Shortlink code '${shortCode}' is disabled`;
      logger.warn(error, { shortCode }, "ShortlinkRouter");
      return { success: false, redirectUrl: "", originalUrl: "", error };
    }

    // Update click count
    route.clickCount++;

    // Track click asynchronously
    this.clickTracker.trackClick({
      ...clickData,
      shortCode,
    }).catch((error: Error) => {
      // Don't fail redirect for tracking errors
      logger.warn(
        "Failed to track click",
        {
          shortCode,
          error: error instanceof Error ? error.message : String(error),
        },
        "ShortlinkRouter",
      );
    });

    // Log redirect for analytics
    logger.info(
      "Shortlink redirect resolved",
      {
        shortCode,
        affiliateUrl: route.affiliateUrl,
        productName: route.productName,
        clickCount: route.clickCount,
      },
      "ShortlinkRouter",
    );

    return {
      success: true,
      redirectUrl: route.affiliateUrl,
      originalUrl: route.originalUrl,
    };
  }

  public addRoute(route: ShortlinkRoute): void {
    if (this.routes.has(route.shortCode)) {
      throw new Error(`Shortlink code '${route.shortCode}' already exists`);
    }

    this.routes.set(route.shortCode, route);
    logger.info(
      "New shortlink route added",
      {
        shortCode: route.shortCode,
        productName: route.productName,
      },
      "ShortlinkRouter",
    );
  }

  public updateRoute(
    shortCode: string,
    updates: Partial<ShortlinkRoute>,
  ): void {
    const route = this.routes.get(shortCode);
    if (!route) {
      throw new Error(`Shortlink code '${shortCode}' not found`);
    }

    const updatedRoute = { ...route, ...updates };
    this.routes.set(shortCode, updatedRoute);

    logger.info(
      "Shortlink route updated",
      {
        shortCode,
        updates: Object.keys(updates),
      },
      "ShortlinkRouter",
    );
  }

  public disableRoute(shortCode: string): void {
    const route = this.routes.get(shortCode);
    if (!route) {
      throw new Error(`Shortlink code '${shortCode}' not found`);
    }

    route.enabled = false;
    this.routes.set(shortCode, route);

    logger.info(
      "Shortlink route disabled",
      {
        shortCode,
      },
      "ShortlinkRouter",
    );
  }

  public getRoute(shortCode: string): ShortlinkRoute | undefined {
    return this.routes.get(shortCode);
  }

  public getAllRoutes(): ShortlinkRoute[] {
    return Array.from(this.routes.values());
  }

  public getStats(): {
    totalRoutes: number;
    enabledRoutes: number;
    platformDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  } {
    const routes = this.getAllRoutes();
    const platformDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};

    for (const route of routes) {
      platformDistribution[route.platform] =
        (platformDistribution[route.platform] || 0) + 1;
      categoryDistribution[route.category] =
        (categoryDistribution[route.category] || 0) + 1;
    }

    return {
      totalRoutes: routes.length,
      enabledRoutes: routes.filter((r) => r.enabled).length,
      platformDistribution,
      categoryDistribution,
    };
  }

  public async generateShortlink(
    originalUrl: string,
    affiliateUrl: string,
    productName: string,
    platform: "lazada" | "shopee",
    category: string,
  ): Promise<string> {
    // Generate unique short code based on product name
    const baseCode = productName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 20);

    let shortCode = baseCode;
    let counter = 1;

    // Ensure uniqueness
    while (this.routes.has(shortCode)) {
      shortCode = `${baseCode}-${counter}`;
      counter++;
    }

    const route: ShortlinkRoute = {
      id: `route-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      shortCode,
      originalUrl,
      affiliateUrl,
      productName,
      platform,
      category,
      enabled: true,
      createdAt: new Date().toISOString(),
      clickCount: 0,
    };

    this.addRoute(route);

    const redirectUrl = `https://racun.ibu.my/${shortCode}`;

    logger.info(
      "Generated new shortlink",
      {
        shortCode,
        productName,
        redirectUrl,
      },
      "ShortlinkRouter",
    );

    return redirectUrl;
  }

  public searchRoutes(
    filters: {
      platform?: "lazada" | "shopee";
      category?: string;
      enabled?: boolean;
      minClicks?: number;
    } = {},
  ): ShortlinkRoute[] {
    let results = Array.from(this.routes.values());

    if (filters.platform) {
      results = results.filter((r) => r.platform === filters.platform);
    }

    if (filters.category) {
      results = results.filter((r) => r.category === filters.category);
    }

    if (filters.enabled !== undefined) {
      results = results.filter((r) => r.enabled === filters.enabled);
    }

    if (filters.minClicks) {
      results = results.filter((r) => r.clickCount >= filters.minClicks!);
    }

    return results.sort((a, b) => b.clickCount - a.clickCount);
  }

  // Helper method to generate HTML response for redirects
  public generateRedirectResponse(
    shortCode: string,
    clickData: Partial<ClickTrackingData> = {},
  ): { status: number; headers: HeadersInit; body: string } {
    const route = this.routes.get(shortCode);

    if (!route || !route.enabled) {
      return {
        status: 404,
        headers: { "Content-Type": "text/html" },
        body: `<html><body><h1>Shortlink Not Found</h1><p>The shortlink code '${shortCode}' is not valid or has been disabled.</p></body></html>`,
      };
    }

    // Track the redirect
    this.resolveShortlink(shortCode, clickData);

    // HTML redirect response with tracking
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting...</title>
        <meta http-equiv="refresh" content="0; url=${route.affiliateUrl}">
        <script>
          window.location.href = '${route.affiliateUrl}';
        </script>
      </head>
      <body>
        <h1>Redirecting...</h1>
        <p>If you are not redirected automatically, <a href="${route.affiliateUrl}">click here</a>.</p>
        <p><small>Redirecting to affiliate partner for: ${route.productName}</small></p>
      </body>
      </html>
    `;

    return {
      status: 302,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        Location: route.affiliateUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      body: html,
    };
  }
}

class ClickTracker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  public async trackClick(data: ClickTrackingData): Promise<void> {
    const timestamp = new Date().toISOString();

    logger.info(
      "Tracking shortlink click",
      {
        shortCode: data.shortCode,
        source: data.source,
        timestamp,
      },
      "ClickTracker",
    );

    // In production, this would send to Supabase or other analytics service
    // For now, we'll log it
    console.log(
      `[ClickTracker] Click tracked: ${data.shortCode} from ${data.source || "unknown"}`,
    );

    // Simulate async tracking operation
    await this.delay(10);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { ShortlinkRouter as default };
