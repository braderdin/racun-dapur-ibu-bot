-- Migration: Add Facebook posts table
-- Created: 2026-07-30

CREATE TABLE IF NOT EXISTS facebook_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'dual')),
  fb_post_id VARCHAR(255) UNIQUE,
  fb_comment_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('published', 'failed', 'pending')),
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Additional metadata for tracking
  lazada_product_id VARCHAR(255),
  lazada_item_id VARCHAR(255),
  copy_used JSONB,
  tags_used TEXT[],
  sentiment_score DECIMAL(3,2),
  image_storage_used JSONB,
  -- Foreign key to posted_products
  posted_product_id BIGINT REFERENCES posted_products(id) ON DELETE SET NULL
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_facebook_posts_product_id ON facebook_posts(product_id);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_platform ON facebook_posts(platform);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_status ON facebook_posts(status);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_timestamp ON facebook_posts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_facebook_posts_source ON facebook_posts(source);

-- Add RLS policy for Facebook posts
ALTER TABLE facebook_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent re-run)
DROP POLICY IF EXISTS select_facebook_posts ON facebook_posts;
DROP POLICY IF EXISTS insert_facebook_posts ON facebook_posts;
DROP POLICY IF EXISTS update_facebook_posts ON facebook_posts;

-- Allow authenticated users to read Facebook posts
CREATE POLICY select_facebook_posts ON facebook_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert Facebook posts
CREATE POLICY insert_facebook_posts ON facebook_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update Facebook posts
CREATE POLICY update_facebook_posts ON facebook_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_facebook_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_facebook_posts_updated_at ON facebook_posts;

CREATE TRIGGER trigger_facebook_posts_updated_at
  BEFORE UPDATE ON facebook_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_facebook_posts_updated_at();

-- Create view for aggregated Facebook posts statistics
CREATE OR REPLACE VIEW facebook_posts_summary AS
SELECT
  DATE_TRUNC('day', timestamp) as post_date,
  platform,
  status,
  COUNT(*) as post_count,
  COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  AVG(sentiment_score) as avg_sentiment_score
FROM facebook_posts
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), platform, status;

COMMENT ON TABLE facebook_posts IS 'Stores Facebook platform posts, comments, and their statuses for dual-channel integration';
COMMENT ON COLUMN facebook_posts.platform IS 'Platform where post was published: facebook, twitter, or dual';
COMMENT ON COLUMN facebook_posts.status IS 'Status: published, failed, or pending';
COMMENT ON COLUMN facebook_posts.source IS 'Source of the post: facebook_graph_api, webhook, manual, etc.';