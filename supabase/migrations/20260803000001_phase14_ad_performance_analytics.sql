-- =============================================================================
-- Phase 14: Ad Performance Analytics Migration
-- Created: 2026-08-03
-- Purpose: Add SQL migration for ad performance analytics materialized views,
--          Row Level Security (RLS) policies, and cron.job auto-cleanup trigger
--          for old click logs (>60 days).
-- =============================================================================

-- Drop tables if exist (for idempotency)
DROP TABLE IF EXISTS ad_events CASCADE;
DROP TABLE IF EXISTS ad_performance_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_ad_performance_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_top_performing_deals CASCADE;

-- ============================================================================
-- Table: ad_events
-- Raw event logs for impressions and clicks
-- ============================================================================

CREATE TABLE ad_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('impression', 'click')),
  deal_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('web', 'x', 'facebook')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  referer TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ad_events
CREATE INDEX idx_ad_events_deal_id ON ad_events(deal_id);
CREATE INDEX idx_ad_events_event_type ON ad_events(event_type);
CREATE INDEX idx_ad_events_platform ON ad_events(platform);
CREATE INDEX idx_ad_events_timestamp ON ad_events(timestamp);
CREATE INDEX idx_ad_events_created_at ON ad_events(created_at);
CREATE INDEX idx_ad_events_metadata_gin ON ad_events USING GIN(metadata);

-- ============================================================================
-- Table: ad_performance_metrics
-- Aggregated metrics for each deal
-- ============================================================================

CREATE TABLE ad_performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  deal_id VARCHAR(255) NOT NULL UNIQUE,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  ctr DECIMAL(10,6) NOT NULL DEFAULT 0,
  platform VARCHAR(20) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ad_performance_metrics
CREATE INDEX idx_ad_perf_deal_id ON ad_performance_metrics(deal_id);
CREATE INDEX idx_ad_perf_platform ON ad_performance_metrics(platform);
CREATE INDEX idx_ad_perf_last_updated ON ad_performance_metrics(last_updated);
CREATE INDEX idx_ad_perf_impressions ON ad_performance_metrics(impressions DESC);

-- ============================================================================
-- Materialized View: mv_ad_performance_daily
-- Daily aggregated ad performance for reporting
-- ============================================================================

CREATE MATERIALIZED VIEW mv_ad_performance_daily AS
SELECT
  DATE_TRUNC('day', timestamp) as day,
  platform,
  COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
  COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
  COUNT(DISTINCT deal_id) as unique_deals,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'click')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'impression'), 0) * 100,
    4
  ) as ctr
FROM ad_events
GROUP BY DATE_TRUNC('day', timestamp), platform
ORDER BY day DESC, platform;

-- Create index on materialized view
CREATE INDEX idx_mv_ad_perf_daily_day ON mv_ad_performance_daily(day);
CREATE INDEX idx_mv_ad_perf_daily_platform ON mv_ad_performance_daily(platform);

-- ============================================================================
-- Materialized View: mv_top_performing_deals
-- Top performing deals by CTR and clicks
-- ============================================================================

CREATE MATERIALIZED VIEW mv_top_performing_deals AS
SELECT
  deal_id,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  ROUND(SUM(clicks)::DECIMAL / NULLIF(SUM(impressions), 0) * 100, 4) as overall_ctr,
  COUNT(DISTINCT platform) as platform_count,
  MAX(last_updated) as last_updated
FROM ad_performance_metrics
GROUP BY deal_id
HAVING SUM(impressions) > 0
ORDER BY overall_ctr DESC, total_clicks DESC
LIMIT 100;

-- Create index on materialized view
CREATE INDEX idx_mv_top_deals_ctr ON mv_top_performing_deals(overall_ctr DESC);
CREATE INDEX idx_mv_top_deals_clicks ON mv_top_performing_deals(total_clicks DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on ad_events
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ad_performance_metrics
ALTER TABLE ad_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read ad_events
CREATE POLICY "ad_events_read_policy" ON ad_events
  FOR SELECT TO authenticated
  USING (true);

-- RLS Policy: Allow authenticated users to insert ad_events
CREATE POLICY "ad_events_insert_policy" ON ad_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS Policy: Allow authenticated users to read ad_performance_metrics
CREATE POLICY "ad_perf_metrics_read_policy" ON ad_performance_metrics
  FOR SELECT TO authenticated
  USING (true);

-- RLS Policy: Allow authenticated users to upsert ad_performance_metrics
CREATE POLICY "ad_perf_metrics_upsert_policy" ON ad_performance_metrics
  FOR INSERT, UPDATE TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- Auto-cleanup Trigger Function
-- Delete old click logs (>60 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ad_events()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete events older than 60 days
  DELETE FROM ad_events
  WHERE timestamp < NOW() - INTERVAL '60 days';
  
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ad_performance_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_performing_deals;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Cron Job: Schedule daily cleanup at 02:00 UTC
-- ============================================================================

-- Check if cron.job extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule daily cleanup at 02:00 UTC
    SELECT cron.schedule(
      'cleanup-old-ad-events',
      '0 2 * * *',
      $$SELECT cleanup_old_ad_events()$$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Manual cleanup required.';
  END IF;
END $$;

-- ============================================================================
-- Triggers for automatic timestamp updates
-- ============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ad_events
CREATE TRIGGER trigger_update_ad_events_updated_at
  BEFORE UPDATE ON ad_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for ad_performance_metrics
CREATE TRIGGER trigger_update_ad_perf_metrics_updated_at
  BEFORE UPDATE ON ad_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Insert initial data for testing (optional)
-- ============================================================================

-- Insert sample ad events for testing
INSERT INTO ad_events (event_type, deal_id, platform, ip_address, user_agent, referer, metadata)
VALUES
  ('impression', 'deal_001', 'web', '192.168.1.1', 'Mozilla/5.0', 'https://racun.ibu.my', '{"category": "kitchen"}'),
  ('click', 'deal_001', 'web', '192.168.1.2', 'Mozilla/5.0', 'https://racun.ibu.my', '{"category": "kitchen"}'),
  ('impression', 'deal_002', 'x', '103.21.244.50', 'Twitter/1.0', 'https://twitter.com', '{"category": "baby"}'),
  ('click', 'deal_002', 'x', '103.21.244.51', 'Twitter/1.0', 'https://twitter.com', '{"category": "baby"}');

-- Insert initial performance metrics
INSERT INTO ad_performance_metrics (deal_id, impressions, clicks, ctr, platform)
VALUES
  ('deal_001', 100, 5, 5.0, 'web'),
  ('deal_002', 200, 15, 7.5, 'x')
ON CONFLICT (deal_id) DO NOTHING;

-- ============================================================================
-- Refresh materialized views
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_ad_performance_daily;
REFRESH MATERIALIZED VIEW mv_top_performing_deals;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE ad_events IS 'Raw ad event logs for impressions and clicks';
COMMENT ON TABLE ad_performance_metrics IS 'Aggregated ad performance metrics per deal';
COMMENT ON MATERIALIZED VIEW mv_ad_performance_daily IS 'Daily aggregated ad performance for reporting';
COMMENT ON MATERIALIZED VIEW mv_top_performing_deals IS 'Top performing deals by CTR and clicks';
COMMENT ON FUNCTION cleanup_old_ad_events() IS 'Cleanup function for old ad events and refresh materialized views';