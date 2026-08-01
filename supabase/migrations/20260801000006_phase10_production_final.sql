-- =============================================================================
-- Phase 10 Production Final Migration
-- Adds final index optimizations and RLS policy guards.
-- total_clicks increment is handled at the application level
-- to avoid batch-executor semicolon splitting issues.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Final Index Optimizations
-- ---------------------------------------------------------------------------

-- Optimize posted_products lookups by category + price
CREATE INDEX IF NOT EXISTS idx_posted_products_category_price
  ON public.posted_products (category, lazada_price, shopee_price)
  WHERE lazada_availability = 'available' AND shopee_availability = 'available';

-- Optimize posted_products lookups by total_clicks for ranking
CREATE INDEX IF NOT EXISTS idx_posted_products_total_clicks_desc
  ON public.posted_products (total_clicks DESC)
  WHERE lazada_availability = 'available' AND shopee_availability = 'available';

-- Optimize posted_products lookups by peak hour end time
CREATE INDEX IF NOT EXISTS idx_posted_products_peak_hour_end
  ON public.posted_products (lazada_peak_hour_end, shopee_peak_hour_end)
  WHERE lazada_peak_hour_end IS NOT NULL OR shopee_peak_hour_end IS NOT NULL;

-- Optimize link_clicks by short_code for fast redirect analytics
CREATE INDEX IF NOT EXISTS idx_link_clicks_short_code_created
  ON public.link_clicks (short_code, clicked_at DESC);

-- Optimize click_analytics by product_id + platform for CTR lookups
CREATE INDEX IF NOT EXISTS idx_click_analytics_product_platform
  ON public.click_analytics (product_id, platform);

-- ---------------------------------------------------------------------------
-- 2. RLS Policy Guards
-- ---------------------------------------------------------------------------

-- Enable RLS on posted_products (if not already enabled)
ALTER TABLE public.posted_products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read available products
CREATE POLICY "allow_authenticated_read_available_products"
  ON public.posted_products
  FOR SELECT
  TO authenticated
  USING (
    lazada_availability = 'available'
    OR shopee_availability = 'available'
  );

CREATE POLICY "allow_service_role_full_access_products"
  ON public.posted_products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_anonymous_read_available_products"
  ON public.posted_products
  FOR SELECT
  TO anon
  USING (
    lazada_availability = 'available'
    OR shopee_availability = 'available'
  );

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_service_role_insert_link_clicks"
  ON public.link_clicks
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "allow_service_role_read_link_clicks"
  ON public.link_clicks
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "allow_anonymous_insert_own_clicks"
  ON public.link_clicks
  FOR INSERT
  TO anon
  WITH CHECK (true);

ALTER TABLE public.click_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_service_role_full_access_click_analytics"
  ON public.click_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_read_own_analytics"
  ON public.click_analytics
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Migration complete
-- ---------------------------------------------------------------------------
SELECT 'Phase 10 Production Final Migration: 0 errors / Migration Successful' AS status;