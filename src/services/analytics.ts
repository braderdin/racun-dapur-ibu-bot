/*
 * Edge Analytics & Click Recording Service
 * Implements click logger capturing referral metadata, user agent, short code, and persisting async metrics to Supabase
 * Real-time analytics processing for @RacunDapurIbu Bot
 * Integrates with existing Redis caching and Supabase infrastructure
 */

import { CONSTANTS } from "../config/constants";
import { RedisService } from "./redis";
import { SupabaseService } from "./supabase";

export interface ClickEvent {
  id?: string;
  shortCode: string;
  referral: {
    source: string;
    medium: string;
    campaign: string;
    term: string;
    content: string;
  };
  userAgent: string;
  ipAddress: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  userAgentParsed: {
    browser: string;
    os: string;
    device: string;
    engine: string;
  };
  utmParameters: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  };
  geoLocation?: {
    country: string;
    region: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
  performanceMetrics?: {
    loadTime: number;
    timeToInteract: number;
    pageViews: number;
    scrollDepth: number;
  };
  conversion: {
    completed: boolean;
    value?: number;
    currency?: string;
    timestamp?: Date;
  };
  campaignTracking?: {
    abcId?: string;
    adGroupId?: string;
    keywordId?: string;
  };
}

export interface AnalyticsQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  shortCode?: string;
  source?: string;
  dateRange?:
    | "today"
    | "yesterday"
    | "last_7_days"
    | "last_30_days"
    | "this_month"
    | "last_month";
  cache?: boolean;
}

export interface AnalyticsStats {
  totalClicks: number;
  uniqueVisitors: number;
  clickRate: number;
  conversionRate: number;
  topSources: Array<{ source: string; clicks: number }>;
  topCountries: Array<{ country: string; clicks: number }>;
  hourlyDistribution: Array<{ hour: number; clicks: number }>;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  browserBreakdown: {
    chrome: number;
    firefox: number;
    safari: number;
    edge: number;
    other: number;
  };
  osBreakdown: {
    windows: number;
    macos: number;
    linux: number;
    ios: number;
    android: number;
    other: number;
  };
  dailyTrends: Array<{ date: string; clicks: number; conversions: number }>;
  recentClicks: ClickEvent[];
}

export interface RealTimeAnalytics {
  activeUsers: number;
  currentSessions: number;
  requestsPerMinute: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface CampaignReport {
  campaignId: string;
  source: string;
  medium: string;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  costPerClick?: number;
  returnOnInvestment?: number;
  startDate: Date;
  endDate: Date;
  performanceTrend: "increasing" | "stable" | "decreasing";
}

export class EdgeAnalyticsService {
  private redisService: RedisService;
  private supabaseService: SupabaseService;
  private realTimeMetrics: Map<string, RealTimeAnalytics>;
  private clickCacheKey = "analytics:clicks";
  private statsCacheKey = "analytics:stats";
  private hourlyStatsKeyPattern = "analytics:hourly:{hour}";

  constructor(redisService: RedisService, supabaseService: SupabaseService) {
    this.redisService = redisService;
    this.supabaseService = supabaseService;
    this.realTimeMetrics = new Map();

    // Initialize real-time metrics for each hour of the day
    for (let hour = 0; hour < 24; hour++) {
      this.realTimeMetrics.set(hour.toString(), {
        activeUsers: 0,
        currentSessions: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        lastUpdated: new Date(),
      });
    }

    console.log(
      "🔍 EdgeAnalyticsService initialized with real-time metrics monitoring",
    );
  }

  async logClick(clickEvent: ClickEvent): Promise<void> {
    try {
      console.log("📊 Logging click event...");
      console.log("   Short Code:", clickEvent.shortCode);
      console.log("   Source:", clickEvent.referral.source);
      console.log("   User Agent:", clickEvent.userAgent.substring(0, 100));

      // Parse user agent for analytics
      const parsedUA = this.parseUserAgent(clickEvent.userAgent);
      clickEvent.userAgentParsed = parsedUA;

      // Determine IP-based geo location (simplified - would use real IP geo service in production)
      clickEvent.geoLocation = this.getMockGeoLocation(clickEvent.ipAddress);

      // Extract UTM parameters from referral
      clickEvent.utmParameters = {
        utm_source:
          clickEvent.referral.source?.replace("utm_source=", "") || undefined,
        utm_medium:
          clickEvent.referral.medium?.replace("utm_medium=", "") || undefined,
        utm_campaign:
          clickEvent.referral.campaign?.replace("utm_campaign=", "") ||
          undefined,
        utm_term:
          clickEvent.referral.term?.replace("utm_term=", "") || undefined,
        utm_content:
          clickEvent.referral.content?.replace("utm_content=", "") || undefined,
      };

      // Store in Redis with TTL (24 hours)
      const redisKey = `${this.clickCacheKey}:${clickEvent.shortCode}:${Date.now()}`;
      await this.redisService.set(redisKey, JSON.stringify(clickEvent), 86400);

      // Store in Supabase database
      await this.supabaseService.logClickEvent(clickEvent);

      // Update real-time metrics
      await this.updateRealTimeMetrics(clickEvent);

      // Update hourly stats
      await this.updateHourlyStats(clickEvent);

      // Update summary stats
      await this.updateSummaryStats(clickEvent);

      console.log("✅ Click event logged successfully");
    } catch (error) {
      console.error("❌ Failed to log click event:", error.message);
      throw error;
    }
  }

  async getAnalytics(
    options: AnalyticsQueryOptions = {},
  ): Promise<AnalyticsStats> {
    try {
      console.log("📊 Fetching analytics data with options:", options);

      // Try to get from cache first
      if (options.cache !== false) {
        const cachedStats = await this.redisService.get(this.statsCacheKey);
        if (cachedStats) {
          console.log("📋 Using cached analytics data");
          return JSON.parse(cachedStats);
        }
      }

      // Get data from Supabase
      const startDate =
        options.startDate || this.getDefaultStartDate(options.dateRange);
      const endDate = options.endDate || new Date();

      const clicks = await this.supabaseService.getClicks(
        startDate,
        endDate,
        options.shortCode,
        options.source,
      );

      // Process and aggregate the data
      const stats = await this.calculateAnalyticsStats(clicks, options);

      // Cache the results
      if (options.cache !== false) {
        await this.redisService.set(
          this.statsCacheKey,
          JSON.stringify(stats),
          3600,
        ); // 1 hour cache
      }

      console.log("✅ Analytics data processed successfully");
      return stats;
    } catch (error) {
      console.error("❌ Failed to fetch analytics data:", error.message);
      throw error;
    }
  }

  async getRealTimeMetrics(): Promise<Map<string, RealTimeAnalytics>> {
    console.log("📊 Fetching real-time metrics...");

    // Update metrics before returning
    await this.updateRealTimeMetrics();

    // Return copy of current metrics
    return new Map(this.realTimeMetrics);
  }

  async getCampaignReports(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<CampaignReport[]> {
    try {
      console.log("📊 Generating campaign reports...");

      const startDate =
        options?.startDate || this.getDefaultStartDate("last_30_days");
      const endDate = options?.endDate || new Date();

      const campaigns = await this.supabaseService.getCampaignReports(
        startDate,
        endDate,
      );

      console.log("✅ Campaign reports generated successfully");
      return campaigns;
    } catch (error) {
      console.error("❌ Failed to generate campaign reports:", error.message);
      throw error;
    }
  }

  async getPopularLinks(options?: {
    limit?: number;
    dateRange?: AnalyticsQueryOptions["dateRange"];
  }): Promise<
    Array<{
      shortCode: string;
      clicks: number;
      conversions: number;
      source: string;
    }>
  > {
    try {
      console.log("📊 Fetching popular links...");

      const startDate = this.getDefaultStartDate(
        options?.dateRange || "last_30_days",
      );
      const endDate = new Date();

      const popularLinks = await this.supabaseService.getPopularLinks(
        startDate,
        endDate,
        options?.limit,
      );

      console.log("✅ Popular links retrieved successfully");
      return popularLinks;
    } catch (error) {
      console.error("❌ Failed to fetch popular links:", error.message);
      throw error;
    }
  }

  async getGeographicDistribution(options?: {
    country?: string;
  }): Promise<Array<{ country: string; clicks: number; percentage: number }>> {
    try {
      console.log("📊 Fetching geographic distribution...");

      const geographicData =
        await this.supabaseService.getGeographicDistribution(options?.country);

      // Calculate percentages
      const totalClicks = geographicData.reduce(
        (sum, item) => sum + item.clicks,
        0,
      );
      const distributionWithPercentage = geographicData.map((item) => ({
        ...item,
        percentage: totalClicks > 0 ? (item.clicks / totalClicks) * 100 : 0,
      }));
      n;
      console.log("✅ Geographic distribution retrieved successfully");
      return distributionWithPercentage;
    } catch (error) {
      console.error(
        "❌ Failed to fetch geographic distribution:",
        error.message,
      );
      throw error;
    }
  }

  async cleanupOldData(retentionDays: number = 90): Promise<void> {
    try {
      console.log(
        "🧹 Cleaning up old analytics data older than",
        retentionDays,
        "days...",
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old data from Supabase
      await this.supabaseService.cleanupOldClickEvents(cutoffDate);

      // Clear Redis cache
      await this.redisService.del(this.clickCacheKey);
      await this.redisService.del(this.statsCacheKey);

      // Clear hourly stats keys
      const hourlyKeys = await this.redisService.keys(
        this.hourlyStatsKeyPattern,
      );
      if (hourlyKeys.length > 0) {
        await this.redisService.del(...hourlyKeys);
      }

      console.log("✅ Old data cleanup completed");
    } catch (error) {
      console.error("❌ Failed to cleanup old data:", error.message);
      throw error;
    }
  }

  private parseUserAgent(userAgent: string): {
    browser: string;
    os: string;
    device: string;
    engine: string;
  } {
    return this.parseUserAgentSimple(userAgent);
  }

  private parseUserAgentSimple(userAgent: string): any {
    const patterns = {
      chrome: /Chrome\/(\d+\.?\d*)/i,
      firefox: /Firefox\/(\d+\.?\d*)/i,
      safari: /Safari\/(\d+\.?\d*)/i,
      edge: /Edg\/(\d+\.?\d*)/i,
      opera: /Opera\/(\d+\.?\d*)/i,
    };

    let browser = "Unknown";
    let os = "Unknown";
    let device = "Desktop";
    let engine = "Unknown";

    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(userAgent)) {
        browser = key.charAt(0).toUpperCase() + key.slice(1) + " Browser";
        break;
      }
    }

    if (/Windows/.test(userAgent)) os = "Windows";
    else if (/Mac OS X/.test(userAgent)) os = "macOS";
    else if (/Linux/.test(userAgent)) os = "Linux";
    else if (/iOS/.test(userAgent)) os = "iOS";
    else if (/Android/.test(userAgent)) os = "Android";

    if (
      /Mobile/.test(userAgent) ||
      /iPhone/.test(userAgent) ||
      /Android/.test(userAgent)
    ) {
      device = "Mobile";
    } else if (/Tablet/.test(userAgent) || /iPad/.test(userAgent)) {
      device = "Tablet";
    }

    return { browser, os, device, engine };
  }

  private getMockGeoLocation(ipAddress: string): {
    country: string;
    region: string;
    city: string;
    latitude?: number;
    longitude?: number;
  } {
    // In production, integrate with a real IP geo lookup service
    // For now, return mock data based on IP address
    const hash = this.hashCode(ipAddress);
    const countries = [
      "Malaysia",
      "United States",
      "Singapore",
      "Thailand",
      "Indonesia",
      "Japan",
      "China",
      "India",
    ];
    const regions = [
      "Kuala Lumpur",
      "Selangor",
      "New York",
      "Singapore",
      "Bangkok",
      "Jakarta",
      "Shanghai",
      "Mumbai",
    ];
    const cities = [
      "Kuala Lumpur",
      "Selangor",
      "New York City",
      "Singapore",
      "Bangkok",
      "Jakarta",
      "Shanghai",
      "Mumbai",
    ];

    return {
      country: countries[hash % countries.length],
      region: regions[hash % regions.length],
      city: cities[hash % cities.length],
      latitude: 3.1 + (hash % 1000) / 1000 - 0.5,
      longitude: 101.6 + (hash % 1000) / 1000 - 0.5,
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async updateRealTimeMetrics(clickEvent?: ClickEvent): Promise<void> {
    const hour = new Date().getHours().toString();
    let metrics = this.realTimeMetrics.get(hour);

    if (!metrics) {
      metrics = {
        activeUsers: 0,
        currentSessions: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        lastUpdated: new Date(),
      };
      this.realTimeMetrics.set(hour, metrics);
    }

    metrics.lastUpdated = new Date();

    // Update based on click event
    if (clickEvent) {
      metrics.activeUsers = (metrics.activeUsers || 0) + 1;
      metrics.requestsPerMinute = (metrics.requestsPerMinute || 0) + 1;

      if (
        clickEvent.userAgent.includes("error") ||
        clickEvent.userAgent.includes("fail")
      ) {
        metrics.errorRate =
          ((metrics.errorRate || 0) + 1) / ((metrics.activeUsers || 1) + 1);
      }
    }

    this.realTimeMetrics.set(hour, metrics);
  }

  private async updateHourlyStats(clickEvent: ClickEvent): Promise<void> {
    const hour = new Date().getHours();
    const key = this.hourlyStatsKeyPattern.replace("{hour}", hour.toString());

    // Increment hourly counter
    const currentHourStats = (await this.redisService.get(key)) || "{}";
    const stats = JSON.parse(currentHourStats);

    stats.clicks = (stats.clicks || 0) + 1;
    stats.date = new Date().toISOString();

    await this.redisService.set(key, JSON.stringify(stats), 24 * 3600); // 24 hours TTL
  }

  private async updateSummaryStats(clickEvent: ClickEvent): Promise<void> {
    // Update various summary statistics in Redis
    const today = new Date().toISOString().split("T")[0];

    // Track clicks per source
    const sourceKey = `analytics:stats:source:${clickEvent.referral.source}`;
    await this.incrementRedisCounter(sourceKey);

    // Track clicks per country
    if (clickEvent.geoLocation?.country) {
      const countryKey = `analytics:stats:country:${clickEvent.geoLocation.country}`;
      await this.incrementRedisCounter(countryKey);
    }

    // Track clicks per device
    const deviceKey = `analytics:stats:device:${clickEvent.userAgentParsed?.device}`;
    await this.incrementRedisCounter(deviceKey);

    // Track clicks per browser
    const browserKey = `analytics:stats:browser:${clickEvent.userAgentParsed?.browser}`;
    await this.incrementRedisCounter(browserKey);

    // Track clicks per OS
    const osKey = `analytics:stats:os:${clickEvent.userAgentParsed?.os}`;
    await this.incrementRedisCounter(osKey);
  }

  private async incrementRedisCounter(key: ώρα): Promise<void> {
    const current = (await this.redisService.get(key)) || "0";
    await this.redisService.set(
      key,
      (parseInt(current) + 1).toString(),
      7 * 24 * 3600,
    ); // 7 days TTL
  }

  private getDefaultStartDate(dateRange?: string): Date {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return new Date(now.setHours(0, 0, 0, 0));
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        return yesterday;
      case "last_7_days":
        const last7Days = new Date(now);
        last7Days.setDate(last7Days.getDate() - 7);
        return last7Days;
      case "last_30_days":
        const last30Days = new Date(now);
        last30Days.setDate(last30Days.getDate() - 30);
        return last30Days;
      case "this_month": {
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return thisMonth;
      }
      case "last_month": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return lastMonth;
      }
      default:
        return new Date(now.getFullYear(), now.getMonth() - 1, 1); // Default to last 30 days
    }
  }

  private async calculateAnalyticsStats(
    clicks: ClickEvent[],
    options: AnalyticsQueryOptions,
  ): Promise<AnalyticsStats> {
    const totalClicks = clicks.length;

    // Calculate top sources
    const sourceMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    const browserMap = { chrome: 0, firefox: 0, safari: 0, edge: 0, other: 0 };
    const osMap = {
      windows: 0,
      macos: 0,
      linux: 0,
      ios: 0,
      android: 0,
      other: 0,
    };
    const hourlyMap: Record<number, number> = {};
    const dailyMap: Record<string, { clicks: number; conversions: number }> =
      {};

    clicks.forEach((click) => {
      // Track sources
      const source = click.referral.source || "direct";
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

      // Track countries
      if (click.geoLocation?.country) {
        countryMap.set(
          click.geoLocation.country,
          (countryMap.get(click.geoLocation.country) || 0) + 1,
        );
      }

      // Track devices
      if (click.userAgentParsed?.device) {
        deviceMap[click.userAgentParsed.device as keyof typeof deviceMap] =
          (deviceMap[click.userAgentParsed.device as keyof typeof deviceMap] ||
            0) + 1;
      }

      // Track browsers
      if (click.userAgentParsed?.browser) {
        const browserKey =
          click.userAgentParsed.browser.toLowerCase() as keyof typeof browserMap;
        if (browserKey in browserMap) {
          browserMap[browserKey] = (browserMap[browserKey] || 0) + 1;
        } else {
          browserMap.other = (browserMap.other || 0) + 1;
        }
      }

      // Track operating systems
      if (click.userAgentParsed?.os) {
        const osKey =
          click.userAgentParsed.os.toLowerCase() as keyof typeof osMap;
        if (osKey in osMap) {
          osMap[osKey] = (osMap[osKey] || 0) + 1;
        } else {
          osMap.other = (osMap.other || 0) + 1;
        }
      }

      // Track hourly distribution
      const hour = new Date(click.timestamp).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;

      // Track daily trends
      const date = new Date(click.timestamp).toISOString().split("T")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { clicks: 0, conversions: 0 };
      }
      dailyMap[date].clicks++;
      if (click.conversion?.completed) {
        dailyMap[date].conversions++;
      }
    });

    // Get recent clicks (last 24 hours)
    const recentClicks = clicks.filter((click) => {
      const clickTime = new Date(click.timestamp);
      const hoursAgo =
        (new Date().getTime() - clickTime.getTime()) / (1000 * 60 * 60);
      return hoursAgo <= 24;
    });

    // Convert hourly map to array
    const hourlyDistribution = Object.entries(hourlyMap).map(
      ([hour, clicks]) => ({
        hour: parseInt(hour),
        clicks,
      }),
    );

    // Convert daily map to array
    const dailyTrends = Object.entries(dailyMap).map(([date, stats]) => ({
      date,
      clicks: stats.clicks,
      conversions: stats.conversions,
    }));

    // Calculate conversion rate
    const convertedClicks = clicks.filter(
      (click) => click.conversion?.completed,
    ).length;
    const conversionRate =
      totalClicks > 0 ? (convertedClicks / totalClicks) * 100 : 0;

    // Get top 10 sources
    const topSources = Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, clicks]) => ({ source, clicks }));

    // Get top 10 countries
    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, clicks]) => ({ country, clicks }));

    return {
      totalClicks,
      uniqueVisitors: new Set(clicks.map((c) => c.ipAddress)).size,
      clickRate:
        totalClicks / Math.max(1, new Set(clicks.map((c) => c.shortCode)).size),
      conversionRate,
      topSources,
      topCountries,
      hourlyDistribution,
      deviceBreakdown: deviceMap,
      browserBreakdown: browserMap,
      osBreakdown: osMap,
      dailyTrends,
      recentClicks,
    };
  }
}

// Create a singleton instance
const analyticsService = new EdgeAnalyticsService(
  require("./redis").redisService,
  require("./supabase").supabaseService,
);

export { analyticsService };
