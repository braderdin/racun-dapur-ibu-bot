"use client";

import { createClient } from '@supabase/supabase-js';

export type CatalogProduct = {
  id: string;
  sku: string;
  lazada_url: string;
  lazada_affiliate_code?: string;
  lazada_price?: number;
  lazada_discount?: number;
  lazada_sold?: number;
  lazada_rating?: number;
  lazada_image?: string;
  shopee_url: string;
  shopee_affiliate_code?: string;
  shopee_price?: number;
  shopee_discount?: number;
  shopee_sold?: number;
  shopee_rating?: number;
  shopee_image?: string;
  product_name: string;
  product_description: string;
  category: string;
  tags?: string;
  lazada_shipping_fee?: number;
  shopee_shipping_fee?: number;
  lazada_availability: string;
  shopee_availability: string;
  lazada_weight?: number;
  shopee_weight?: number;
  lazada_dimensions?: string;
  shopee_dimensions?: string;
  lazada_coupon?: string;
  shopee_flash_sales?: string;
  lazada_flash_sales?: string;
  lazada_peak_hour_discount?: number;
  shopee_peak_hour_discount?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;

  // Pembayaran & Flash Sales
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;

  // Harga yang Berlaku
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;
  lazada_peak_hour_current_price?: number;
  shopee_peak_hour_current_price?: number;
  lazada_peak_hour_original_price?: number;
  shopee_peak_hour_original_price?: number;
  lazada_peak_hour_percent?: number;
  shopee_peak_hour_percent?: number;
  lazada_peak_hour_end?: string;
  shopee_peak_hour_end?: string;
  lazada_peak_hour_remaining?: number;
  shopee_peak_hour_remaining?: number;

  // Analisis & Metadata
  lazada_total_peak_hour_sales?: number;
  shopee_total_peak_hour_sales?: number;
  lazada_peak_hour_views?: number;
  shopee_peak_hour_views?: number;
  lazada_peak_hour_conversion_rate?: number;
  shopee_peak_hour_conversion_rate?: number;
  lazada_peak_hour_ctr?: number;
  shopee_peak_hour_ctr?: number;
  lazada_peak_hour_avg_cart_value?: number;
  shopee_peak_hour_avg_cart_value?: number;
  lazada_peak_hour_revenue?: number;
  shopee_peak_hour_revenue?: number;
  lazada_peak_hour_profit?: number;
  shopee_peak_hour_profit?: number;
  lazada_peak_hour_roi?: number;
  shopee_peak_hour_roi?: number;
  lazada_peak_hour_cpa?: number;
  shopee_peak_hour_cpa?: number;
  lazada_peak_hour_cpl?: number;
  shopee_peak_hour_cpl?: number;
  lazada_peak_hour_cpc?: number;
  shopee_peak_hour_cpc?: number;

  // Masa & Kadaluarsa
  lazada_peak_hour_start?: string;
  shopee_peak_hour_start?: string;
  lazada_peak_hour_duration?: number;
  shopee_peak_hour_duration?: number;
  lazada_peak_hour_ends_soon?: boolean;
  shopee_peak_hour_ends_soon?: boolean;
  lazada_peak_hour_ends_in?: number;
  shopee_peak_hour_ends_in?: number;
  lazada_peak_hour_ends_exact?: string;
  shopee_peak_hour_ends_exact?: string;

  // Komposisi Penjualan
  lazada_peak_hour_composite_rank?: number;
  shopee_peak_hour_composite_rank?: number;
  lazada_peak_hour_price_rank?: number;
  shopee_peak_hour_price_rank?: number;
  lazada_peak_hour_discount_rank?: number;
  shopee_peak_hour_discount_rank?: number;
  lazada_peak_hour_sales_rank?: number;
  shopee_peak_hour_sales_rank?: number;
  lazada_peak_hour_rating_rank?: number;
  shopee_peak_hour_rating_rank?: number;
  lazada_peak_hour_newness_score?: number;
  shopee_peak_hour_newness_score?: number;
  lazada_peak_hour_freshness_score?: number;
  shopee_peak_hour_freshness_score?: number;

  // PERBATASAN & STATUS PRODUK
  lazada_peak_hour_stock_status?: string;
  shopee_peak_hour_stock_status?: string;
  lazada_peak_hour_limit_per_customer?: number;
  shopee_peak_hour_limit_per_customer?: number;
  lazada_peak_hour_min_order_qty?: number;
  shopee_peak_hour_min_order_qty?: number;
  lazada_peak_hour_max_order_qty?: number;
  shopee_peak_hour_max_order_qty?: number;

  // valid_from & valid_to timestamps for peak hour
  lazada_peak_hour_valid_from?: string;
  shopee_peak_hour_valid_from?: string;
  lazada_peak_hour_valid_to?: string;
  shopee_peak_hour_valid_to?: string;

  // Tagihan & Logistik
  lazada_peak_hour_cod?: string;
  shopee_peak_hour_cod?: string;
  lazada_peak_hour_insurance?: number;
  shopee_peak_hour_insurance?: number;
  lazada_peak_hour_fragile_item_surcharge?: number;
  shopee_peak_hour_fragile_item_surcharge?: number;
  lazada_peak_hour_large_item_surcharge?: number;
  shopee_peak_hour_large_item_surcharge?: number;

  // Statistik Pelanggan & Kepuasan
  lazada_peak_hour_total_reviews?: number;
  shopee_peak_hour_total_reviews?: number;
  lazada_peak_hour_satisfaction_rate?: number;
  shopee_peak_hour_satisfaction_rate?: number;
  lazada_peak_hour_customer_loyalty_score?: number;
  shopee_peak_hour_customer_loyalty_score?: number;
  lazada_peak_hour_repeat_purchase_rate?: number;
  shopee_peak_hour_repeat_purchase_rate?: number;
  lazada_peak_hour_nps_score?: number;
  shopee_peak_hour_nps_score?: number;

  // Trend & Musiman
  lazada_peak_hour_seasonal_trend?: string;
  shopee_peak_hour_seasonal_trend?: string;
  lazada_peak_hour_ramadan_special?: boolean;
  shopee_peak_hour_chinese_new_year?: boolean;
  lazada_peak_hour_eid ?: boolean;
  shopee_peak_hour_haida?: boolean;
  lazada_peak_hour_school_holiday?: boolean;
  shopee_peak_hour_school_holiday?: boolean;
  lazada_peak_hour_national_day?: boolean;
  shopee_peak_hour_national_day?: boolean;

  // Ekonomi & Saringan
  lazada_peak_hour_gdp_impact?: number;
  shopee_peak_hour_gdp_impact?: number;
  lazada_peak_hour_inflation_surcharge?: number;
  shopee_peak_hour_inflation_surcharge?: number;
  lazada_peak_hour_administrative_fee?: number;
  shopee_peak_hour_administrative_fee?: number;
  lazada_peak_hour_tax_implications?: number;
  shopee_peak_hour_tax_implications?: number;
  lazada_peak_hour_tariff_subsidy?: number;
  shopee_peak_hour_tariff_subsidy?: number;

  // Kewangan & Pematuhan
  lazada_peak_hour_interest_rate?: number;
  shopee_peak_hour_interest_rate?: number;
  lazada_peak_hour_cashback_rate?: number;
  shopee_peak_hour_cashback_rate?: number;
  lazada_peak_hour_discount_points?: number;
  shopee_peak_hour_discount_points?: number;
  lazada_peak_hour_reward_points?: number;
  shopee_peak_hour_reward_points?: number;
  lazada_peak_hour_currency_rate?: number;
  shopee_peak_hour_currency_rate?: number;
  lazada_peak_hour_exchange_rate?: number;
  shopee_peak_hour_exchange_rate?: number;

  // Automasi & Risiko
  lazada_peak_hour_ai_assisted?: boolean;
  shopee_peak_hour_ai_assisted?: boolean;
  lazada_peak_hour_computerized_price_check?: boolean;
  shopee_peak_hour_computerized_price_check?: boolean;
  lazada_peak_hour_dynamic_pricing?: boolean;
  shopee_peak_hour_dynamic_pricing?: boolean;
  lazada_peak_hour_price_volatility?: number;
  shopee_peak_hour_price_volatility?: number;
  lazada_peak_hour_automation_risk?: number;
  shopee_peak_hour_automation_risk?: number;

  // Pengeluaran & Pelancongan
  lazada_peak_hour_logistics_expense?: number;
  shopee_peak_hour_logistics_expense?: number;
  lazada_peak_hour_marketing_expense?: number;
  shopee_peak_hour_marketing_expense?: number;
  lazada_peak_hour_operations_expense?: number;
  shopee_peak_hour_operations_expense?: number;
  lazada_peak_hour_customer_service_expense?: number;
  shopee_peak_hour_customer_service_expense?: number;

  // Kerahsiaan & Kualiti
  lazada_peak_hour_quality_rating?: number;
  shopee_peak_hour_quality_rating?: number;
  lazada_peak_hour_certification_standard?: string;
  shopee_peak_hour_certification_standard?: string;
  lazada_peak_hour_bulk_discount?: number;
  shopee_peak_hour_bulk_discount?: number;
  lazada_peak_hour_tier_pricing?: string;
  shopee_peak_hour_tier_pricing?: string;
  lazada_peak_hour_exclusivity?: boolean;
  shopee_peak_hour_exclusivity?: boolean;

  // End of CatalogProduct interface
};

export interface SearchParams {
  query?: string;
  filters?: Partial<FilterCriteria>;
  limit?: number;
  offset?: number;
}

export interface FilterCriteria {
  category?: string;
  budget?: {
    min?: number;
    max?: number;
  };
  discountMin?: number;
  tags?: string[];
}

export interface RealtimeEventPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'posted_products';
  event: {
    timestamp: string;
    op: 'INSERT' | 'UPDATE' | 'DELETE';
  };
  new?: CatalogProduct;
  old?: CatalogProduct;
}

export interface CatalogStats {
  total_products?: number;
  category_stats?: Record<string, number>;
  budget_distribution?: {
    '<20': number;
    '20-50': number;
    '50-100': number;
    '>100': number;
  };
  active_deals?: number;
  flash_sales?: number;
}

export interface CatalogResponse {
  data: CatalogProduct[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  search_query?: string;
  filters_applied?: FilterCriteria;
}

export interface CatalogSearchResult {
  id: string;
  product_name: string;
  product_description: string;
  category: string;
  lazada_price?: number;
  shopee_price?: number;
  lazada_discount?: number;
  shopee_discount?: number;
  lazada_image?: string;
  shopee_image?: string;
  lazada_available?: boolean;
  shopee_available?: boolean;
  total_clicks?: number;
  flash_sale?: boolean;
  flash_sale_ends_in?: number;
}

export class CatalogService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // 🔍 FTS Search with Weighted Scoring
  async searchProducts(params: SearchParams): Promise<CatalogResponse> {
    const {
      query,
      filters,
      limit = 20,
      offset = 0,
    } = params;

    // Start building query
    let queryBuilder = this.supabase
      .from('posted_products')
      .select(
        'id, sku, product_name, product_description, category, tags, '
        + 'lazada_price, lazada_discount, lazada_image, '
        + 'shopee_price, shopee_discount, shopee_image, '
        + 'lazada_availability, shopee_availability, total_clicks, '
        + 'lazada_peak_hour_percent, shopee_peak_hour_percent, '
        + 'lazada_peak_hour_current_price, shopee_peak_hour_current_price, '
        + 'lazada_peak_hour_end, shopee_peak_hour_end, '
        + 'lazada_peak_hour_remaining, shopee_peak_hour_remaining'
      )
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available')
      .order('total_clicks', { ascending: false });

    // Apply FTS if query provided
    if (query?.trim()) {
      const phrase = query.toLowerCase().trim();

      // Use Supabase's text search for Malay/English support
      queryBuilder = queryBuilder.textSearch(
        'to_tsvector(COALESCE(lazada_product_name, \"\") || \" \" || COALESCE(shopee_product_name, \"\") )',
        phrase,
        { type: 'plain' }
      );

      // Also apply phrase matching as fallback/boost
      queryBuilder = queryBuilder.or(
        `product_name.ilike.%${phrase}%`,` + `shopee_product_name.ilike.%${phrase}%`,` + `lazada_sku.ilike.%${phrase}%',' + `shopee_sku.ilike.%${phrase}%'`
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        queryBuilder = queryBuilder.eq('category', filters.category);
      }

      if (filters.discountMin) {
        queryBuilder = queryBuilder.or(
          `lazada_discount.gte.${filters.discountMin}`,' + `shopee_discount.gte.${filters.discountMin}%'`
        );
      }

      // Budget filter (post-processing)
      if (filters.budget?.max) {
        // Will apply after fetch for simplicity
      }
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) throw new Error(`Search failed: ${error.message}`);

    // Apply budget filter client-side (for simplicity)
    let filteredData = data || [];

    if (filters?.budget?.max) {
      filteredData = filteredData.filter(product => {
        const lazadaPrice = product.lazada_price || Infinity;
        const shopeePrice = product.shopee_price || Infinity;
        const minPrice = filters.budget?.min || 0;

        return (
          (lazadaPrice <= filters.budget.max && lazadaPrice >= minPrice) ||
          (shopeePrice <= filters.budget.max && shopeePrice >= minPrice)
        );
      });
    }

    return {
      data: filteredData as CatalogProduct[],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
      search_query: query,
      filters_applied: filters,
    };
  }

  // 🏷️ Get active deals with flash sale emphasis
  async getActiveDeals(limit: number = 50): Promise<CatalogProduct[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('posted_products')
      .select(
        'id, sku, lazada_url, shopee_url, product_name, ' +
        'product_description, category, lazada_price, shopee_price, ' +
        'lazada_discount, shopee_discount, lazada_image, shopee_image, '
        + 'lazada_availability, shopee_availability, total_clicks, '
        + 'lazada_peak_hour_percent, shopee_peak_hour_percent, '
        + 'lazada_peak_hour_end, shopee_peak_hour_end, '
        + 'lazada_peak_hour_remaining, shopee_peak_hour_remaining'
      )
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available')
      .gte('total_clicks', 0)
      .order('total_clicks', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch active deals: ${error.message}`);

    // Filter for flash sales
    const flashSaleProducts = (data || [])
      .filter(product => {
        const lazadaEnds = product.lazada_peak_hour_end;
        const shopeeEnds = product.shopee_peak_hour_end;
        const lazadaRemaining = product.lazada_peak_hour_remaining;
        const shopeeRemaining = product.shopee_peak_hour_remaining;

        return (
          (lazadaEnds && new Date(lazadaEnds) > new Date() && lazadaRemaining > 0) ||
          (shopeeEnds && new Date(shopeeEnds) > new Date() && shopeeRemaining > 0)
        );
      })
      .slice(0, 10); // Limit to top 10 flash sales

    return data as CatalogProduct[];
  }

  // 💰 Get products filtered by price range
  async getProductsByBudget(
    minPrice: number = 0,
    maxPrice: number = 1000,
    limit: number = 50
  ): Promise<CatalogProduct[]> {
    const { data, error } = await this.supabase
      .from('posted_products')
      .select(
        'id, sku, lazada_url, shopee_url, product_name, ' +
        'product_description, category, lazada_price, shopee_price, ' +
        'lazada_discount, shopee_discount, lazada_image, shopee_image, '
        + 'lazada_availability, shopee_availability, total_clicks'
      )
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available')
      .gte('total_clicks', 0)
      .limit(limit)
      .order('total_clicks', { ascending: false });

    if (error) throw new Error(`Failed to fetch budget products: ${error.message}`);

    // Client-side filter by price range
    return (data || []).filter(product => {
      const lazadaPrice = product.lazada_price || Infinity;
      const shopeePrice = product.shopee_price || Infinity;

      return (
        (lazadaPrice >= minPrice && lazadaPrice <= maxPrice) ||
        (shopeePrice >= minPrice && shopeePrice <= maxPrice)
      );
    });
  }

  // 📊 Get catalog statistics
  async getCatalogStats(): Promise<CatalogStats> {
    const { data, error } = await this.supabase
      .from('posted_products')
      .select(
        'id, category, lazada_price, shopee_price, ' +
        'lazada_peak_hour_percent, shopee_peak_hour_percent, '
        + 'lazada_peak_hour_end, shopee_peak_hour_end, '
        + 'lazada_peak_hour_remaining, shopee_peak_hour_remaining, '
        + 'total_clicks'
      )
      .eq('lazada_availability', 'available')
      .eq('shopee_availability', 'available');

    if (error) throw new Error(`Failed to fetch catalog stats: ${error.message}`);

    const products = data as CatalogProduct[];

    // Calculate statistics
    const categoryStats: Record<string, number> = {};
    const budgetDistribution = { '<20': 0, '20-50': 0, '50-100': 0, '>100': 0 };
    let activeDeals = 0;
    let flashSales = 0;

    products.forEach(product => {
      const lazadaPrice = product.lazada_price || 0;
      const shopeePrice = product.shopee_price || 0;

      // Category count
      if (product.category) {
        categoryStats[product.category] = (categoryStats[product.category] || 0) + 1;
      }

      // Budget distribution
      const lazadaLazanadaPrice = lazadaPrice || Infinity;
      const shopeePriceVal = shopeePrice || Infinity;
      const minPrice = Math.min(lazadaPrice, shopeePrice);

      if (minPrice < 20) budgetDistribution['<20']++;
      else if (minPrice < 50) budgetDistribution['20-50']++;
      else if (minPrice < 100) budgetDistribution['50-100']++;
      else budgetDistribution['>100']++;

      // Flash sales
      const lazadaEnds = product.lazada_peak_hour_end;
      const shopeeEnds = product.shopee_peak_hour_end;
      const lazadaRemaining = product.lazada_peak_hour_remaining;
      const shopeeRemaining = product.shopee_peak_hour_remaining;

      if ((lazadaEnds && new Date(lazadaEnds) > new Date() && lazadaRemaining > 0) ||
          (shopeeEnds && new Date(shopeeEnds) > new Date() && shopeeRemaining > 0)) {
        flashSales++;
      }

      // Active deals (any available product)
      if (product.lazada_availability === 'available' || product.shopee_availability === 'available') {
        activeDeals++;
      }
    });

    return {
      total_products: products.length,
      category_stats: categoryStats,
      budget_distribution: budgetDistribution,
      active_deals: activeDeals,
      flash_sales: flashSales,
    };
  }

  // 📦 Get single product by ID
  async getProductById(productId: string): Promise<CatalogProduct | null> {
    const { data, error } = await this.supabase
      .from('posted_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch product: ${error.message}`);
    }

    return data as CatalogProduct;
  }

  // 🔄 Subscribe to product changes
  subscribeToChanges(
    callback: (payload: RealtimeEventPayload) => void
  ): () => void {
    const channel = this.supabase
      .channel('catalog-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'posted_products',
        },
        (payload) => {
          const realtimePayload: RealtimeEventPayload = {
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: payload.table,
            event: {
              timestamp: new Date().toISOString(),
              op: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            },
            new: payload.new as CatalogProduct | null,
            old: payload.old as CatalogProduct | null,
          };

          callback(realtimePayload);
        }
      );

    channel.subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }

  // 🛠️ Get preview data for development
  async getPreviewData(): Promise<any> {
    const { data, error } = await this.supabase
      .from('posted_products')
      .select('*')
      .limit(10);

    if (error) throw new Error(`Failed to fetch preview data: ${error.message}`);

    return data;
  }
}

export const catalogService = new CatalogService();