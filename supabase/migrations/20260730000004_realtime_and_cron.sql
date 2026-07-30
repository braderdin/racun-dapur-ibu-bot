-- =======================================
-- Migration: Add realtime publication and cron jobs
-- Description: Enable Supabase Realtime for catalog changes and set up maintenance cron jobs
-- Date: 2026-07-30T00:00:04Z
-- =======================================

-- 1. Add posted_products table to supabase_realtime publication
-- This enables real-time synchronization for catalog changes
ALTER PUBLICATION supabase_realtime ADD TABLE posted_products;

-- 2. Create trigger function for auto-incrementing total_clicks
-- This is triggered automatically whenever a new click is inserted
CREATE OR REPLACE FUNCTION increment_total_clicks()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posted_products
    SET total_clicks = total_clicks + 1
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on click_logs table
-- Fires after each click insertion to update product click counts
CREATE TRIGGER trigger_increment_total_clicks
AFTER INSERT ON click_logs
FOR EACH ROW
EXECUTE FUNCTION increment_total_clicks();

-- 4. Set up pg_cron job for cleaning up old analytics data
-- Removes analytics data older than 60 days to maintain database efficiency
SELECT cron.schedule(
    'cleanup_analytics_60d',
    '0 3 * * *',  -- Run daily at 3:00 AM UTC
    $$
    DELETE FROM click_logs WHERE created_at < NOW() - INTERVAL '60 days';
    $$
);

-- 5. Create FTS index for better search performance
-- Optimized for both Malay and English language search
CREATE INDEX IF NOT EXISTS idx_posted_products_fts ON posted_products USING gin(to_tsvector('public', COALESCE(product_name, '') || ' ' || COALESCE(product_description, '')));

-- 6. Create partial index for active products
-- Faster queries for available products only
CREATE INDEX IF NOT EXISTS idx_posted_products_active ON posted_products (id)
WHERE lazada_availability = 'available' AND shopee_availability = 'available';

-- 7. Create trigger for updated_at timestamp
-- Automatically update timestamp on record modifications
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_posted_products_updated_at
BEFORE UPDATE ON posted_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. Create composite index for flash sale queries
-- Optimizes queries filtering by peak hour sales and availability
CREATE INDEX IF NOT EXISTS idx_posted_products_flash_sale ON posted_products (
    lazada_peak_hour_end,
    shopee_peak_hour_end,
    lazada_availability,
    shopee_availability
);

-- 9. Create index for category-based filtering
-- Improves catalog browsing by category
CREATE INDEX IF NOT EXISTS idx_posted_products_category ON posted_products (category);

-- 10. Create index for budget-based filtering
-- Optimizes queries by price range
CREATE INDEX IF NOT EXISTS idx_posted_products_lazada_price ON posted_products (lazada_price);
CREATE INDEX IF NOT EXISTS idx_posted_products_shopee_price ON posted_products (shopee_price);

-- 11. Create index for trending queries
-- Optimizes sorting by total_clicks and timestamps
CREATE INDEX IF NOT EXISTS idx_posted_products_trending ON posted_products (
    total_clicks DESC,
    lazada_peak_hour_end,
    shopee_peak_hour_end
);

-- 12. Set up Realtime publication for specific tables
-- Optional: Create dedicated publication for catalog changes
DROP PUBLICATION IF EXISTS catalog_realtime;
CREATE PUBLICATION catalog_realtime FOR TABLE posted_products;

-- 13. Create RPC function for budget filtering
-- Reusable function for efficient budget-based queries
CREATE OR REPLACE FUNCTION get_products_budget(
    min_budget INT DEFAULT 0,
    max_budget INT DEFAULT NULL,
    category_filter TEXT DEFAULT NULL,
    limit_count INT DEFAULT 50
)
RETURNS TABLE (
    id TEXT,
    product_name TEXT,
    category TEXT,
    lazada_price DECIMAL,
    shopee_price DECIMAL,
    lazada_discount DECIMAL,
    shopee_discount DECIMAL,
    lazada_image TEXT,
    shopee_image TEXT,
    lazada_availability TEXT,
    shopee_availability TEXT,
    total_clicks INT,
    lazada_peak_hour_percent DECIMAL,
    shopee_peak_hour_percent DECIMAL
)
LANGUAGE sql
STABLE
AS $$
SELECT
    p.id,
    p.product_name,
    p.category,
    p.lazada_price,
    p.shopee_price,
    p.lazada_discount,
    p.shopee_discount,
    p.lazada_image,
    p.shopee_image,
    p.lazada_availability,
    p.shopee_availability,
    p.total_clicks,
    p.lazada_peak_hour_percent,
    p.shopee_peak_hour_percent
FROM posted_products p
WHERE (p.lazada_price >= min_budget OR p.shopee_price >= min_budget)
  AND (max_budget IS NULL OR p.lazada_price <= max_budget OR p.shopee_price <= max_budget)
  AND (category_filter IS NULL OR p.category = category_filter)
  AND (p.lazada_availability = 'available' OR p.shopee_availability = 'available')
ORDER BY
    (p.lazada_price + p.shopee_price) ASC,
    p.total_clicks DESC
LIMIT limit_count;
$$
;

-- 14. Create RPC function for full-text search
-- Optimized for Malay/English keyword search with relevance scoring
CREATE OR REPLACE FUNCTION search_products_fts(
    search_query TEXT,
    limit_count INT DEFAULT 20
)
RETURNS TABLE (
    id TEXT,
    product_name TEXT,
    product_description TEXT,
    category TEXT,
    lazada_price DECIMAL,
    shopee_price DECIMAL,
    lazada_discount DECIMAL,
    shopee_discount DECIMAL,
    lazada_image TEXT,
    shopee_image TEXT,
    lazada_availability TEXT,
    shopee_availability TEXT,
    total_clicks INT,
    lazada_peak_hour_percent DECIMAL,
    shopee_peak_hour_percent DECIMAL,
    lazada_peak_hour_end TIMESTAMPTZ,
    shopee_peak_hour_end TIMESTAMPTZ,
    search_rank REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    EXECUTE format(
        '%%%
        SELECT
            p.id,
            p.product_name,
            p.product_description,
            p.category,
            p.lazada_price,
            p.shopee_price,
            p.lazada_discount,
            p.shopee_discount,
            p.lazada_image,
            p.shopee_image,
            p.lazada_availability,
            p.shopee_availability,
            p.total_clicks,
            p.lazada_peak_hour_percent,
            p.shopee_peak_hour_percent,
            p.lazada_peak_hour_end,
            p.shopee_peak_hour_end,
            ts_rank(
                to_tsvector('public', COALESCE(p.product_name, '') || '' || COALESCE(p.product_description, '')),
                plainto_tsquery('public', %L)
            ) as search_rank
        FROM posted_products p
        WHERE (
            to_tsvector('public', COALESCE(p.product_name, '''') || '' || COALESCE(p.product_description, '''')) @@ plainto_tsquery('public', %L)
            OR p.product_name ILIKE %L
            OR p.product_description ILIKE %L
        )
        AND (p.lazada_availability = ''available'' OR p.shopee_availability = ''available'')
        ORDER BY search_rank DESC, p.total_clicks DESC
        LIMIT %s',
        search_query,  -- Parameter 1: tsquery
        search_query,  -- Parameter 2: ilike pattern
        search_query,  -- Parameter 3: ilike pattern
        limit_count    -- Parameter 4: limit
    );
END;
$$
;

-- 15. Create maintenance cron job for analytics cleanup
-- Runs weekly to clean up old analytics data and optimize database
SELECT cron.schedule(
    'weekly_analytics_cleanup',
    '0 2 * * 0',  -- Run weekly on Sunday at 2:00 AM UTC
    $$
    -- Clean up click logs older than 90 days
    DELETE FROM click_logs WHERE created_at < NOW() - INTERVAL '90 days';
    -- Clean up temporary cache entries
    DELETE FROM pg_catalog.pg_stat_statements WHERE timestamp < NOW() - INTERVAL '7 days';
    $$
);

-- 16. Set up monitoring and alerting
-- Creates table for tracking system health
CREATE TABLE IF NOT EXISTS system_health_logs (
    id SERIAL PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_service_name ON system_health_logs (service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON system_health_logs (created_at);

-- 17. Create view for aggregated catalog statistics
-- Pre-computed view for faster dashboard loading
CREATE OR REPLACE VIEW catalog_stats AS
SELECT
    COUNT(*) as total_products,
    COUNT(DISTINCT category) as unique_categories,
    COUNT(*) FILTER (WHERE lazada_peak_hour_percent > 0 OR shopee_peak_hour_percent > 0) as flash_sale_products,
    AVG(COALESCE(lazada_price, 0)) as avg_lazada_price,
    AVG(COALESCE(shopee_price, 0)) as avg_shopee_price,
    MAX(COALESCE(lazada_price, 0)) as max_lazada_price,
    MAX(COALESCE(shopee_price, 0)) as max_shopee_price,
    SUM(total_clicks) as total_clicks,
    SUM(total_clicks) / COUNT(*) as avg_clicks_per_product,
    NOW() as last_updated
FROM posted_products
WHERE lazada_availability = 'available' AND shopee_availability = 'available';

COMMENT ON VIEW catalog_stats IS 'Aggregated catalog statistics for dashboard display and analytics';

-- 18. Create trigger for auto-cleanup of inactive products
-- Optional: Archive products that haven't been updated in 30 days
CREATE OR REPLACE FUNCTION archive_inactive_products()
RETURNS TRIGGER AS $$
BEGIN
    -- Optional: Move archived products to separate table
    -- This is currently a placeholder - implementation depends on business needs
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 19. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 20. Set up Row Level Security (RLS) for service
ALTER TABLE posted_products ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public can read available products
CREATE POLICY public_read_available_products ON posted_products
FOR SELECT TO public
USING (lazada_availability = 'available' OR shopee_availability = 'available');

-- RLS Policy: Service role can perform all operations
CREATE POLICY service_all_operations ON posted_products
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Comments for documentation
COMMENT ON MIGRATION '20260730000004_realtime_and_cron' IS 'Add realtime publication, click tracking triggers, and maintenance cron jobs';
COMMENT ON TABLE posted_products IS 'Main catalog products table with dual-platform support';
COMMENT ON COLUMN posted_products.total_clicks IS 'Total number of clicks tracked for this product';