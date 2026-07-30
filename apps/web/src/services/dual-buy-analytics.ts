"use client";

import { CatalogProduct } from './supabase-catalog';
import { createClient } from '@supabase/supabase-js';

export interface DualBuyClickEvent {
  productId: string;
  platform: 'lazada' | 'shopee';
  affiliateCode?: string;
  timestamp: string;
  userAgent?: string;
  referrer?: string;
  sessionId?: string;
  ipAddress?: string;
}

export interface ClickAnalyticsData {
  productId: string;
  platform: 'lazada' | 'shopee';
  clickCount: number;
  lastClickAt: string;
  affiliateCode?: string;
  totalConversions?: number;
  conversionRate?: number;
}

export class DualBuyAnalyticsService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // 📈 Track dual buy button clicks with metadata
  async trackClick(event: DualBuyClickEvent): Promise<void> {
    const {
      productId,
      platform,
      affiliateCode,
      userAgent,
      referrer,
      sessionId,
      ipAddress,
    } = event;

    const clickData = {
      product_id: productId,
      platform,
      affiliate_code: affiliateCode,
      timestamp: new Date().toISOString(),
      user_agent: userAgent,
      referrer,
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent_device: this.extractDevice(userAgent),
      user_agent_browser: this.extractBrowser(userAgent),
      user_agent_os: this.extractOS(userAgent),
    };

    // Insert into Supabase click_logs table (using service role for writes)
    const { error } = await this.supabase
      .from('click_logs')
      .insert([clickData]);

    if (error) {
      console.error('Failed to track click:', error);
      // Don't throw - analytics should not break user flow
      return;
    }

    // Also update the posted_products total_clicks counter
    await this.incrementProductClickCount(productId);
  }

  // 🔄 Increment click count for product (optimistic update)
  private async incrementProductClickCount(productId: string): Promise<void> {
    try {
      // Use Supabase RPC function for atomic increment
      const { error } = await this.supabase
        .rpc('increment_total_clicks', { product_id: productId });

      if (error) {
        console.error('Failed to increment click count:', error);
      }
    } catch (error) {
      console.error('Error incrementing click count:', error);
      // Fallback: direct update (less efficient but works)
      try {
        await this.supabase
          .from('posted_products')
          .update({ total_clicks: this.supabase.raw('total_clicks + 1') })
          .eq('id', productId);
      } catch (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
      }
    }
  }

  // 📊 Get click analytics for product
  async getClickAnalytics(productId: string, timeRange?: {
    start?: string;
    end?: string;
  }): Promise<ClickAnalyticsData | null> {
    let query = this.supabase
      .from('click_logs')
      .select('*)
      .eq('product_id', productId)
      .order('timestamp', { ascending: false });

    if (timeRange?.start && timeRange?.end) {
      query = query.gte('timestamp', timeRange.start)
                   .lte('timestamp', timeRange.end);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Failed to get click analytics:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Calculate aggregated metrics
    const clicksByPlatform = data.reduce((acc: any, click) => {
      if (!acc[click.platform]) {
        acc[click.platform] = {
          count: 0,
          conversions: 0,
          lastClickAt: click.timestamp,
        };
      }
      acc[click.platform].count++;
      if (click.converted_at) {
        acc[click.platform].conversions++;
      }
      if (new Date(click.timestamp) > new Date(acc[click.platform].lastClickAt)) {
        acc[click.platform].lastClickAt = click.timestamp;
      }
      return acc;
    }, {});

    const result: ClickAnalyticsData = {
      productId,
      platform: Object.keys(clicksByPlatform)[0] as 'lazada' | 'shopee' || 'lazada',
      clickCount: data.length,
      lastClickAt: data[0].timestamp,
    };

    // Get affiliate code from posted_products
    const { data: product } = await this.supabase
      .from('posted_products')
      .select('lazada_affiliate_code, shopee_affiliate_code')
      .eq('id', productId)
      .single();

    if (product) {
      result.affiliateCode = 
        product.platform === 'lazada' ? product.lazada_affiliate_code :
        product.platform === 'shopee' ? product.shopee_affiliate_code :
        undefined;
    }

    return result;
  }

  // 🔍 Get popular products by click count
  async getPopularProducts(limit: number = 10, timeRange?: {
    start?: string;
    end?: string;
  }): Promise<any[]> {
    let query = this.supabase
      .from('posted_products')
      .select(
        'id, product_name, category, lazada_price, shopee_price, '
        + 'lazada_discount, shopee_discount, lazada_image, shopee_image, '
        + 'total_clicks, lazada_peak_hour_percent, shopee_peak_hour_percent'
      )
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available')
      .order('total_clicks', { ascending: false })
      .limit(limit);

    if (timeRange?.start && timeRange?.end) {
      query = query.gte('created_at', timeRange.start)
                   .lte('created_at', timeRange.end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get popular products:', error);
      return [];
    }

    return data || [];
  }

  // 📈 Get click trends over time
  async getClickTrends(hours: number = 24): Promise<any[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('click_logs')
      .select('timestamp, platform')
      .gte('timestamp', startTime)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Failed to get click trends:', error);
      return [];
    }

    // Group clicks by hour
    const trends = data.reduce((acc: any, click) => {
      const hour = new Date(click.timestamp).toISOString().slice(0, 13) + ':00';
      if (!acc[hour]) {
        acc[hour] = { hour, lazada: 0, shopee: 0, total: 0 };
      }
      if (click.platform === 'lazada') {
        acc[hour].lazada++;
      } else if (click.platform === 'shopee') {
        acc[hour].shopee++;
      }
      acc[hour].total++;
      return acc;
    }, {});

    return Object.values(trends).sort((a: any, b: any) => 
      new Date(a.hour).getTime() - new Date(b.hour).getTime()
    );
  }

  // 📊 Get dashboard analytics
  async getDashboardAnalytics(): Promise<any> {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get today's clicks
    const { data: todayClicks, error: todayError } = await this.supabase
      .from('click_logs')
      .select('*)
      .gte('timestamp', startOfDay);

    if (todayError) {
      console.error('Failed to get today\'s clicks:', todayError);
    }

    // Get last 24 hours clicks
    const { data: recentClicks, error: recentError } = await this.supabase
      .from('click_logs')
      .select('*)
      .gte('timestamp', last24Hours);

    if (recentError) {
      console.error('Failed to get recent clicks:', recentError);
    }

    // Get top clicked products
    const { data: topProducts, error: productsError } = await this.supabase
      .from('posted_products')
      .select('id, product_name, total_clicks, category')
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available')
      .order('total_clicks', { ascending: false })
      .limit(10);

    if (productsError) {
      console.error('Failed to get top products:', productsError);
    }

    return {
      metrics: {
        totalClicksToday: todayClicks?.length || 0,
        totalClicks24h: recentClicks?.length || 0,
        uniqueProductsToday: [...new Set(todayClicks?.map(c => c.product_id))].length,
        platformsToday: {
          lazada: todayClicks?.filter(c => c.platform === 'lazada').length || 0,
          shopee: todayClicks?.filter(c => c.platform === 'shopee').length || 0,
        },
      },
      topProducts: topProducts || [],
      recentActivity: recentClicks || [],
    };
  }

  // 🔧 Utility functions
  private extractDevice(userAgent: string | undefined): string {
    if (!userAgent) return 'unknown';

    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private extractBrowser(userAgent: string | undefined): string {
    if (!userAgent) return 'unknown';

    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/opera/i.test(userAgent)) return 'Opera';
    return 'Unknown';
  }

  private extractOS(userAgent: string | undefined): string {
    if (!userAgent) return 'unknown';

    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  // 🧪 Test analytics service
  async testAnalytics(): Promise<boolean> {
    try {
      // Test by attempting to insert a test click
      const testEvent: DualBuyClickEvent = {
        productId: 'test-product-id',
        platform: 'lazada',
        timestamp: new Date().toISOString(),
        userAgent: 'Test/AnalyticsService',
      };

      await this.trackClick(testEvent);
      return true;
    } catch (error) {
      console.error('Analytics service test failed:', error);
      return false;
    }
  }

  // 🗑️ Cleanup old analytics data (optional maintenance)
  async cleanupOldAnalytics(daysToKeep: number = 60): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await this.supabase
      .from('click_logs')
      .delete()
      .lt('timestamp', cutoffDate);

    if (error) {
      console.error('Failed to cleanup old analytics:', error);
    }
  }
}

// 🌟 Singleton instance
export const dualBuyAnalyticsService = new DualBuyAnalyticsService();