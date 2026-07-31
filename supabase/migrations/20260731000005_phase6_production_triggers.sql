-- ============================================================================
-- Nama Migrasi: 20260731000005_phase6_production_triggers.sql
-- Masa: 2026-07-31
-- Tujuan: Tambah production triggers dan cleanup cron untuk Phase 6 pelancaran 24/7 yang mantap
-- ============================================================================

-- Tambah trigger untuk mengira total_clicks secara automatik ketika klik_analytics baru dimasukkan
DO $$
BEGIN
    -- Create function untuk mengira total_clicks dan status TRENDING
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_total_clicks_count') THEN
        CREATE OR REPLACE FUNCTION update_total_clicks_count()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE posted_products 
            SET total_clicks = (
                SELECT COUNT(*) FROM click_analytics 
                WHERE click_analytics.product_id = NEW.product_id
            )
            WHERE product_id = NEW.product_id;
            
            IF (SELECT COUNT(*) FROM click_analytics WHERE product_id = NEW.product_id) >= 100 THEN
                UPDATE posted_products 
                SET status = '🔥 TRENDING'
                WHERE product_id = NEW.product_id
                AND status != '🔥 TRENDING';
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
    
    -- Tambah trigger yang sesuai
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_total_clicks') THEN
        CREATE TRIGGER trigger_update_total_clicks
        AFTER INSERT ON click_analytics
        FOR EACH ROW
        EXECUTE FUNCTION update_total_clicks_count();
    END IF;
END;
$$;

-- Tambah trigger untuk mengemaskini timestamp updated_at pada kedua-dua tables
DO $$
BEGIN
    -- Create function untuk update_updated_at_column
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
    
    -- Tambah triggers untuk posted_products dan click_analytics
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_posted_products_updated_at') THEN
        CREATE TRIGGER trigger_update_posted_products_updated_at
        BEFORE UPDATE ON posted_products
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_click_analytics_updated_at') THEN
        CREATE TRIGGER trigger_update_click_analytics_updated_at
        BEFORE UPDATE ON click_analytics
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- Tambah index komprehensif untuk performance
CREATE INDEX IF NOT EXISTS idx_posted_products_status_updated_at ON posted_products (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_analytics_conversion_updated_at ON click_analytics (conversion_result, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_analytics_short_code ON click_analytics (short_code);
CREATE INDEX IF NOT EXISTS idx_click_analytics_platform ON click_analytics (platform);
CREATE INDEX IF NOT EXISTS idx_click_analytics_conversion_result ON click_analytics (conversion_result);
CREATE INDEX IF NOT EXISTS idx_click_analytics_clicked_at ON click_analytics (clicked_at);
CREATE INDEX IF NOT EXISTS idx_click_analytics_ip_address ON click_analytics (ip_address);
CREATE INDEX IF NOT EXISTS idx_click_analytics_image_webp_url ON click_analytics (image_webp_url);

-- Tambah pengecekan kekangan data periodik melalui pg_cron
DO $$
BEGIN
    -- Hapus entri click_analytics lama (>60 hari)
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_click_analytics') THEN
        CREATE OR REPLACE FUNCTION cleanup_old_click_analytics()
        RETURNS void AS $$
        BEGIN
            RAISE NOTICE 'Memulakan pembersihan entri click_analytics lama (>60 hari)...';
            DELETE FROM click_analytics 
            WHERE clicked_at < (CURRENT_TIMESTAMP - INTERVAL '60 days');
            RAISE NOTICE 'Selesai: Dipadam % entri lama.', FOUND;
        END;
        $$ LANGUAGE plpgsql;
    END IF;
    
    -- Tambah job pg_cron untuk pembersihan periodik (setiap hari pada 2:00 AM)
    IF NOT EXISTS (SELECT 1 FROM pg_cron_job WHERE jobname = 'clean_old_click_analytics') THEN
        INSERT INTO pg_cron_job (jobname, command, schedule, active, created_at)
        VALUES (
            'clean_old_click_analytics',
            'SELECT cleanup_old_click_analytics();',
            '0 2 * * *', -- Setiap hari pada 2:00 AM
            true,
            CURRENT_TIMESTAMP
        );
    END IF;
END;
$$;

-- Tambah kekangan foreign key dengan pooling dikecualikan
ALTER TABLE click_analytics
DROP CONSTRAINT IF EXISTS fk_click_analytics_product_id;

ALTER TABLE click_analytics
ADD CONSTRAINT fk_click_analytics_product_id
FOREIGN KEY (product_id)
REFERENCES posted_products(product_id)
ON DELETE SET NULL
WITH (pgbouncer = false); -- Bypass transaction pooling for migration safety

-- Tambah kekangan unik untuk domain data
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_product_entry ON posted_products (product_id, date(posted_at));
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_short_code ON click_analytics (short_code);

-- Tambah kekangan standard untuk data wajib
ALTER TABLE click_analytics
ADD CONSTRAINT chk_conversion_result_valid CHECK (conversion_result IN (TRUE, FALSE)),
ADD CONSTRAINT chk_affiliate_url_valid CHECK (affiliate_url ~ '^https?://[^\\s/$.?#].[^\\s]*$'),
ADD CONSTRAINT chk_product_id_valid CHECK (product_id IS NULL OR (product_id ~ '^product_[a-zA-Z0-9_]{20,}$')),
ADD CONSTRAINT chk_clicked_at_not_future CHECK (clicked_at <= CURRENT_TIMESTAMP),
ADD CONSTRAINT chk_metadata_json_valid CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');

-- Ambil semula kekangan untuk click_analytics
ALTER TABLE click_analytics ENABLE ROW LEVEL SECURITY;

-- Ambil semula kekangan untuk posted_products  
ALTER TABLE posted_products ENABLE ROW LEVEL SECURITY;

-- Tambah komentar untuk dokumentasi
COMMENT ON TABLE click_analytics IS 'Click analytics tracking for shortener URLs with conversion metrics and WebP image storage';
COMMENT ON COLUMN click_analytics.short_code IS 'Unique short code identifier';
COMMENT ON COLUMN click_analytics.affiliate_url IS 'Source affiliate URL that generated the link';
COMMENT ON COLUMN click_analytics.product_id IS 'Product reference identifier';
COMMENT ON COLUMN click_analytics.clicked_at IS 'Timestamp when the short link was clicked';
COMMENT ON COLUMN click_analytics.platform IS 'Product platform (lazada or shopee)';

COMMENT ON TRIGGER trigger_update_total_clicks ON click_analytics IS 'Triggers total_clicks counting and TRENDING status updates';
COMMENT ON TRIGGER trigger_update_posted_products_updated_at ON posted_products IS 'Updates updated_at timestamp on record modification';
COMMENT ON TRIGGER trigger_update_click_analytics_updated_at ON click_analytics IS 'Updates updated_at timestamp on record modification';

-- Memberi diri pandu arah untuk pengurus
\echo 'Migration 20260731000005_phase6_production_triggers.sql Executed Successfully';
\echo '--- Summary of Changes ---';
\echo '1. Added trigger: update_total_clicks_count (click_analytics inserts)';
\echo '2. Added trigger: update_updated_at_column (posted_products & click_analytics)';
\echo '3. Added pg_cron job: clean_old_click_analytics (harian)';
\echo '4. Added production-ready foreign key constraints with pgbouncer bypass';
\echo '5. Added comprehensive indexes for performance';
\echo '6. Added data validation constraints';
\echo '7. Enabled row-level security for both tables';
\echo '--- Ready for Phase 6 E2E Live Testing ---';
