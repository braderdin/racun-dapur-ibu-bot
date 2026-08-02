-- =============================================================================
-- Phase 12: Live Audit Logs Migration
-- Created: 2026-08-02
-- Purpose: Create live_post_audit_logs table for tracking social media posting audits
-- =============================================================================

-- Drop table if exists (for idempotency)
DROP TABLE IF EXISTS live_post_audit_logs;

-- Create live_post_audit_logs table
CREATE TABLE live_post_audit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  
  -- Post identification
  post_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL, -- "twitter", "facebook", "telegram"
  product_id VARCHAR(255) NOT NULL,
  
  -- Content information
  product_title TEXT,
  product_price VARCHAR(50),
  product_discount_rate VARCHAR(20),
  product_rating DECIMAL(3,2),
  product_stock_status VARCHAR(50),
  
  -- Affiliate information
  affiliate_link TEXT,
  cloaked_link TEXT,
  
  -- Social media specific data
  tweet_id VARCHAR(255), -- For Twitter posts
  facebook_post_id VARCHAR(255), -- For Facebook posts
  telegram_message_id BIGINT, -- For Telegram messages
  comment_id VARCHAR(255), -- For comments
  
  -- Media information
  image_url TEXT,
  processed_image_url TEXT,
  
  -- Audit information
  status VARCHAR(50) NOT NULL, -- "pending", "completed", "failed", "overridden"
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE,
  
  -- User information
  user_id VARCHAR(255), -- Telegram user ID or other user identifier
  
  -- Metadata
  metadata JSONB,
  
  -- Indexes for performance
  CONSTRAINT chk_platform CHECK (platform IN ('twitter', 'facebook', 'telegram')),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'completed', 'failed', 'overridden'))
);

-- Create indexes for better query performance
CREATE INDEX idx_live_post_audit_logs_post_id ON live_post_audit_logs(post_id);
CREATE INDEX idx_live_post_audit_logs_platform ON live_post_audit_logs(platform);
CREATE INDEX idx_live_post_audit_logs_product_id ON live_post_audit_logs(product_id);
CREATE INDEX idx_live_post_audit_logs_status ON live_post_audit_logs(status);
CREATE INDEX idx_live_post_audit_logs_created_at ON live_post_audit_logs(created_at);
CREATE INDEX idx_live_post_audit_logs_user_id ON live_post_audit_logs(user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_live_post_audit_logs_updated_at
    BEFORE UPDATE ON live_post_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- INSERT INTO live_post_audit_logs (
--   post_id,
--   platform,
--   product_id,
--   product_title,
--   product_price,
--   product_discount_rate,
--   product_rating,
--   product_stock_status,
--   affiliate_link,
--   cloaked_link,
--   status,
--   created_at,
--   posted_at,
--   user_id
-- ) VALUES (
--   'sample_post_001',
--   'twitter',
--   'laz_001',
--   'Air Fryer 5L Non-Stick Touch Screen Kitchen Appliance',
--   'RM 119.00',
--   '60%',
--   4.5,
--   'available',
--   'https://c.lazada.com.my/t/c.Yxxxx',
--   'https://r.racundapuribu.com/lz-laz001-1234567890-abcdef',
--   'completed',
--   NOW() - INTERVAL '1 day',
--   NOW() - INTERVAL '23 hours',
--   'telegram_user_123'
-- );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON live_post_audit_logs TO postgres;
GRANT SELECT ON live_post_audit_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON live_post_audit_logs TO service_role;

-- Comment
COMMENT ON TABLE live_post_audit_logs IS 'Live post audit logs for tracking social media posting activities and Telegram interactive audits';
COMMENT ON COLUMN live_post_audit_logs.id IS 'Unique identifier for audit log entry';
COMMENT ON COLUMN live_post_audit_logs.post_id IS 'Original post ID from social media platform';
COMMENT ON COLUMN live_post_audit_logs.platform IS 'Social media platform (twitter, facebook, telegram)';
COMMENT ON COLUMN live_post_audit_logs.product_id IS 'Lazada product ID';
COMMENT ON COLUMN live_post_audit_logs.status IS 'Audit status (pending, completed, failed, overridden)';
COMMENT ON COLUMN live_post_audit_logs.created_at IS 'Timestamp when audit log was created';
COMMENT ON COLUMN live_post_audit_logs.updated_at IS 'Timestamp when audit log was last updated';
COMMENT ON COLUMN live_post_audit_logs.posted_at IS 'Timestamp when post was actually posted';

-- End of migration