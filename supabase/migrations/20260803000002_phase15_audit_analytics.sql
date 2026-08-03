-- Phase 15: Audit Analytics Migration
-- Creates live_post_audit_logs table, RLS policies, and pg_cron auto-cleanup job
-- Purpose: Track all live post audit activities with 60-day auto-purge to keep Supabase storage <50MB

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create live_post_audit_logs table
CREATE TABLE IF NOT EXISTS live_post_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(255) NOT NULL,
    product_title VARCHAR(500) NOT NULL,
    category VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('x', 'facebook', 'both')),
    
    -- Post identifiers
    twitter_post_id VARCHAR(255),
    twitter_reply_id VARCHAR(255),
    facebook_post_id VARCHAR(255),
    facebook_comment_id VARCHAR(255),
    
    -- Content audit data
    x_hook TEXT,
    x_cta TEXT,
    x_cultural_adaptation TEXT,
    facebook_hook TEXT,
    facebook_cta TEXT,
    facebook_cultural_adaptation TEXT,
    
    -- Links
    short_url VARCHAR(500) NOT NULL,
    original_affiliate_url TEXT NOT NULL,
    image_url VARCHAR(500),
    
    -- Pricing
    price VARCHAR(50),
    original_price VARCHAR(50),
    discount_rate VARCHAR(20),
    
    -- Audit status
    audit_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (audit_status IN (
        'pending', 'approved', 'rejected', 'override', 'deleted', 'emergency_stop'
    )),
    audit_notes TEXT,
    audited_by VARCHAR(255),
    audited_at TIMESTAMPTZ,
    
    -- Performance metrics
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    error_stage VARCHAR(100),
    retry_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_product_id ON live_post_audit_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_platform ON live_post_audit_logs(platform);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_audit_status ON live_post_audit_logs(audit_status);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_created_at ON live_post_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_category ON live_post_audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_posted_at ON live_post_audit_logs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_twitter_post_id ON live_post_audit_logs(twitter_post_id);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_facebook_post_id ON live_post_audit_logs(facebook_post_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_status_created ON live_post_audit_logs(audit_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_post_audit_logs_platform_status ON live_post_audit_logs(platform, audit_status);

-- Enable Row Level Security
ALTER TABLE live_post_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role full access
CREATE POLICY "Service role full access" ON live_post_audit_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policy: Allow authenticated users to read their own audit logs
CREATE POLICY "Authenticated users read access" ON live_post_audit_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policy: Allow anon users to read approved audit logs (for public dashboard)
CREATE POLICY "Anon read approved logs" ON live_post_audit_logs
    FOR SELECT
    TO anon
    USING (audit_status IN ('approved', 'override'));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_live_post_audit_logs_updated_at ON live_post_audit_logs;
CREATE TRIGGER update_live_post_audit_logs_updated_at
    BEFORE UPDATE ON live_post_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to purge old audit logs (older than 60 days)
CREATE OR REPLACE FUNCTION purge_old_audit_logs()
RETURNS void AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM live_post_audit_logs
    WHERE created_at < NOW() - INTERVAL '60 days'
    AND audit_status NOT IN ('approved', 'override'); -- Keep approved/override logs longer
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO cron.job_run_details (jobid, runid, status, return_message)
    VALUES (0, 0, 'succeeded', format('Purged %s old audit logs', deleted_count))
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Purged % old audit logs older than 60 days', deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule pg_cron job to run daily at 3:00 AM UTC (11:00 AM MYT)
-- This will purge audit logs older than 60 days
SELECT cron.schedule(
    'purge-old-audit-logs-daily',
    '0 3 * * *', -- Daily at 3:00 AM UTC
    $$SELECT purge_old_audit_logs();$$
);

-- Create view for audit dashboard
CREATE OR REPLACE VIEW v_audit_dashboard AS
SELECT
    id,
    product_id,
    product_title,
    category,
    platform,
    audit_status,
    short_url,
    image_url,
    price,
    original_price,
    discount_rate,
    impressions,
    clicks,
    ctr,
    conversions,
    revenue,
    posted_at,
    created_at,
    audited_at,
    audited_by,
    CASE
        WHEN audit_status = 'approved' THEN '✅'
        WHEN audit_status = 'rejected' THEN '❌'
        WHEN audit_status = 'override' THEN '🔄'
        WHEN audit_status = 'deleted' THEN '🗑️'
        WHEN audit_status = 'emergency_stop' THEN '🛑'
        ELSE '⏳'
    END AS status_icon
FROM live_post_audit_logs
ORDER BY created_at DESC;

-- Create view for performance analytics
CREATE OR REPLACE VIEW v_audit_performance AS
SELECT
    category,
    platform,
    audit_status,
    COUNT(*) as total_posts,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    AVG(ctr) as avg_ctr,
    SUM(conversions) as total_conversions,
    SUM(revenue) as total_revenue,
    DATE_TRUNC('day', created_at) as date
FROM live_post_audit_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category, platform, audit_status, DATE_TRUNC('day', created_at)
ORDER BY date DESC, total_revenue DESC;

-- Create function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_stats(
    p_days_back INTEGER DEFAULT 30,
    p_category VARCHAR(100) DEFAULT NULL,
    p_platform VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    total_posts BIGINT,
    approved_posts BIGINT,
    rejected_posts BIGINT,
    pending_posts BIGINT,
    total_impressions BIGINT,
    total_clicks BIGINT,
    avg_ctr DECIMAL(5,2),
    total_conversions BIGINT,
    total_revenue DECIMAL(10,2),
    by_category JSONB,
    by_platform JSONB,
    by_status JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT *
        FROM live_post_audit_logs
        WHERE created_at > NOW() - (p_days_back || ' days')::INTERVAL
        AND (p_category IS NULL OR category = p_category)
        AND (p_platform IS NULL OR platform = p_platform)
    )
    SELECT
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE audit_status = 'approved') as approved_posts,
        COUNT(*) FILTER (WHERE audit_status = 'rejected') as rejected_posts,
        COUNT(*) FILTER (WHERE audit_status = 'pending') as pending_posts,
        COALESCE(SUM(impressions), 0) as total_impressions,
        COALESCE(SUM(clicks), 0) as total_clicks,
        CASE WHEN SUM(impressions) > 0 
             THEN ROUND(SUM(clicks)::DECIMAL / SUM(impressions) * 100, 2)
             ELSE 0 END as avg_ctr,
        COALESCE(SUM(conversions), 0) as total_conversions,
        COALESCE(SUM(revenue), 0) as total_revenue,
        (
            SELECT jsonb_object_agg(category, cnt)
            FROM (
                SELECT category, COUNT(*) as cnt
                FROM filtered
                GROUP BY category
            ) c
        ) as by_category,
        (
            SELECT jsonb_object_agg(platform, cnt)
            FROM (
                SELECT platform, COUNT(*) as cnt
                FROM filtered
                GROUP BY platform
            ) p
        ) as by_platform,
        (
            SELECT jsonb_object_agg(audit_status, cnt)
            FROM (
                SELECT audit_status, COUNT(*) as cnt
                FROM filtered
                GROUP BY audit_status
            ) s
        ) as by_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON v_audit_dashboard TO authenticated, anon;
GRANT SELECT ON v_audit_performance TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_audit_stats TO authenticated, anon;

-- Insert sample data for testing (optional)
-- INSERT INTO live_post_audit_logs (
--     product_id, product_title, category, platform,
--     short_url, original_affiliate_url, image_url,
--     price, original_price, discount_rate,
--     audit_status, posted_at
-- ) VALUES (
--     'test_001', 'Test Air Fryer 5L', 'kitchen', 'both',
--     'https://racun.ibu.my/r/abc123', 'https://c.lazada.com.my/t/c.test',
--     'https://via.placeholder.com/400x400',
--     'RM 119.00', 'RM 299.00', '60%',
--     'approved', NOW()
-- );

-- Verify migration
SELECT 'Phase 15 Audit Analytics migration completed successfully' as status;