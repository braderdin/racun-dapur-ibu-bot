// 🎯 Catalog Core Types

import { Database } from "@supabase/supabase-js";

export type CatalogProduct =
  Database["public"]["Tables"]["posted_products"]["Row"];

// 📊 Search & Filter Types
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

// 🔄 Realtime Types
export interface RealtimeEventPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "posted_products";
  event: {
    timestamp: string;
    op: "INSERT" | "UPDATE" | "DELETE";
  };
  new?: CatalogProduct;
  old?: CatalogProduct;
}

export type RealtimeEventType =
  "NEW_DEAL" | "DEAL_UPDATED" | "FLASH_SALE_START";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: RealtimeEventPayload;
  timestamp: string;
  id: string;
}

// 📊 Analytics Types
export interface CatalogStats {
  total_products?: number;
  category_stats?: Record<string, number>;
  budget_distribution?: {
    "<20": number;
    "20-50": number;
    "50-100": number;
    ">100": number;
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

// 🌡️ Theme & UI Types
export interface KitchenThemeColors {
  cream: string;
  terracotta: string;
  sage: string;
  warmGold: string;
  charcoal: string;
  snowWhite: string;
  copper: string;
}

export interface CategoryColors {
  kitchen: string;
  baby: string;
  skincare: string;
}

// ⏱️ Timer & Countdown Types
export interface CountdownTimer {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalMilliseconds: number;
}

export interface FlashSaleInfo {
  productId: string;
  lazadaPeakHourEnd?: string;
  shopeePeakHourEnd?: string;
  lazadaRemaining?: number;
  shopeeRemaining?: number;
  currentPrice?: number;
  originalPrice?: number;
  discountPercentage?: number;
}

// 💰 Budget Range Types
export type BudgetRange = "<20" | "20-50" | "50-100" | ">100";

export interface BudgetFilter {
  range: BudgetRange;
  min?: number;
  max?: number;
}

// 🔍 Search & Discover Types
export interface SearchSuggestion {
  term: string;
  count: number;
}

export interface SearchFacet {
  category: string;
  count: number;
  color: string;
}

// 📱 Analytics & Tracking Types
export interface ClickEvent {
  productId: string;
  platform: "lazada" | "shopee";
  affiliateCode?: string;
  timestamp: string;
  userAgent?: string;
  referrer?: string;
  sessionId?: string;
}

export interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  session_id?: string;
  data: Record<string, any>;
  timestamp: string;
}

// 🎨 UI Component Types
export interface DealCardProps {
  product: CatalogProduct;
  variant?: "default" | "compact" | "featured";
  showTimer?: boolean;
}

export interface ProductDetail {
  product: CatalogProduct;
  lazadaLink: string;
  shopeeLink: string;
  similarProducts: CatalogProduct[];
}

// 🔔 Notification Types
export interface Notification {
  id: string;
  type: "NEW_DEAL" | "FLASH_SALE" | "PRICE_DROP" | "SYSTEM";
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
}
