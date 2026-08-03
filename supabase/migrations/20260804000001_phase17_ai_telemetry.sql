-- Phase 17: AI Quality Tuning & Telemetry Migration
-- Creates ai_copywriting_logs table with RLS policies and pg_cron auto-cleanup
-- Keeps database size under 50MB with 60-day retention

-- Create ai_copywriting_logs table
CREATE TABLE IF NOT EXISTS ai_copywriting_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id TEXT NOT NULL,
    product_id TEXT,
    prompt_used TEXT NOT NULL,
    generated_copy_x TEXT NOT NULL,
    generated_copy_fb TEXT NOT NULL,
    ai_model TEXT NOT NULL DEFAULT 'openrouter/free',
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
    chip_besar_rating TEXT CHECK (chip_besar_rating IN ('positive', 'negative', 'neutral')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_logs_deal_id ON ai_copywriting_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_product_id ON ai_copywriting_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_ai_model ON ai_copywriting_logs(ai_model);
CREATE INDEX IF NOT EXISTS idx_ai_logs_chip_rating ON ai_copywriting_logs(chip_besar_rating);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_copywriting_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_confidence ON ai_copywriting_logs(confidence_score DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_logs_updated_at ON ai_copywriting_logs;
CREATE TRIGGER update_ai_logs_updated_at
    BEFORE UPDATE ON ai_copywriting_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE ai_copywriting_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service Role can read/write all records
CREATE POLICY IF NOT EXISTS "service_role_full_access" ON ai_copywriting_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Anon users can read only positive-rated copy for learning
CREATE POLICY IF NOT EXISTS "anon_read_positive_ratings" ON ai_copywriting_logs
    FOR SELECT TO anon
    USING (chip_besar_rating = 'positive')
    WITH CHECK (false);

-- Policy: Anon users can insert new logs (for feedback collection)
CREATE POLICY IF NOT EXISTS "anon_insert_new_logs" ON ai_copywriting_logs
    FOR INSERT TO anon
    WITH CHECK (true);

-- pg_cron job to purge logs older than 60 days (keeps DB < 50MB)
-- Estimated size: ~1KB per record, 60 days * 24 hours * 4 posts = ~5760 records max
-- With safety margin, purge at 45 days to ensure < 50MB

-- Create cron job for auto-cleanup (runs daily at 02:00 UTC)
SELECT cron.schedule(
    'phase17-ai-logs-cleanup',
    '0 2 * * *',
    $$
    DELETE FROM ai_copywriting_logs 
    WHERE created_at < NOW() - INTERVAL '45 days';
    $$
);

-- Create function to get AI stats summary
CREATE OR REPLACE FUNCTION get_ai_stats_summary()
RETURNS TABLE(
    total_generations BIGINT,
    avg_response_time_ms NUMERIC,
    avg_confidence NUMERIC,
    positive_ratio NUMERIC,
    negative_ratio NUMERIC,
    neutral_ratio NUMERIC,
    model_distribution JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_generations,
        ROUND(AVG(response_time_ms)::NUMERIC, 2) as avg_response_time_ms,
        ROUND(AVG(confidence_score)::NUMERIC, 3) as avg_confidence,
        ROUND(
            (COUNT(*) FILTER (WHERE chip_besar_rating = 'positive')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as positive_ratio,
        ROUND(
            (COUNT(*) FILTER (WHERE chip_besar_rating = 'negative')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as negative_ratio,
        ROUND(
            (COUNT(*) FILTER (WHERE chip_besar_rating = 'neutral')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as neutral_ratio,
        jsonb_build_object(
            'openrouter/free', COUNT(*) FILTER (WHERE ai_model = 'openrouter/free'),
            'openrouter/pro', COUNT(*) FILTER (WHERE ai_model = 'openrouter/pro'),
            'gemini', COUNT(*) FILTER (WHERE ai_model = 'gemini'),
            'groq', COUNT(*) FILTER (WHERE ai_model = 'groq')
        ) as model_distribution
    FROM ai_copywriting_logs
    WHERE created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create view for easy analytics access
CREATE OR REPLACE VIEW ai_copywriting_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as day,
    ai_model,
    chip_besar_rating,
    COUNT(*) as count,
    AVG(response_time_ms) as avg_response_time_ms,
    AVG(confidence_score) as avg_confidence
FROM ai_copywriting_logs
GROUP BY DATE_TRUNC('day', created_at), ai_model, chip_besar_rating
ORDER BY day DESC, ai_model;

-- Comment on table for documentation
COMMENT ON TABLE ai_copywriting_logs IS 'AI copywriting generation logs with Chip Besar feedback ratings for quality tuning';
COMMENT ON COLUMN ai_copywriting_logs.chip_besar_rating IS 'Chip Besar rating: positive (Ayat Padu), negative (Kurang Menyengat), neutral';
COMMENT ON COLUMN ai_copywriting_logs.confidence_score IS 'AI confidence score (0-1) for generated copy quality';