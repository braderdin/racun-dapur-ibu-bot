-- =============================================================================
-- Nama Migrasi: 20260730000003_facebook_posts.sql
-- Masa: 2026-07-30
-- Tujuan: Tambah kolom untuk Facebook posts dan comment IDs ke posted_products
--          serta membuat jadual facebook_post_logs untuk mengesanyek kronologi penuh penyiaran Facebook.
-- =============================================================================

-- Tambah enum untuk platform Facebook (lazada, shopee, facebook)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform') THEN
        CREATE TYPE platform AS ENUM ('lazada', 'shopee', 'facebook');
    END IF;
END$$;

-- Tambah kolom cawangan ke posted_products untuk menyimpan ID catatan Facebook
ALTER TABLE posted_products
ADD COLUMN IF NOT EXISTS fb_post_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS fb_comment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS fb_post_status VARCHAR(20) DEFAULT 'pending',  -- published, failed, pending
ADD COLUMN IF NOT EXISTS fb_post_error TEXT,                            -- Ralat jika occurs semasa posting Facebook
ADD COLUMN IF NOT EXISTS fb_post_timestamp TIMESTAMP WITH TIME ZONE;

-- Jejaring keselamatan: Buat indeks pantas untuk medan kawalan utama
CREATE INDEX IF NOT EXISTS idx_posted_products_fb_post_id ON posted_products (fb_post_id);
CREATE INDEX IF NOT EXISTS idx_posted_products_fb_post_status ON posted_products (fb_post_status);
CREATE INDEX IF NOT EXISTS idx_posted_products_fb_post_timestamp ON posted_products (fb_post_timestamp);

-- Jejaring keselamatan: Pastikan setiap fb_post_id tidak mempunyai lebih daripada satu entri (Facebook selalunya unik)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_posted_products_fb_post_id_unique ON posted_products (fb_post_id) WHERE fb_post_id IS NOT NULL;

-- Jadual facebook_post_logs untuk mengesanyek kronologi lengkap setiap penyiaran Facebook
CREATE TABLE IF NOT EXISTS facebook_post_logs (
    id bigserial PRIMARY KEY,
    log_id VARCHAR(255) UNIQUE NOT NULL,                         -- Unik: gabungan platform+product+tarikh (contoh: laz-product-20260730-001)
    product_id VARCHAR(255) NOT NULL,
    platform platform NOT NULL,                                 -- 'lazada', 'shopee', 'facebook'
    source_platform VARCHAR(50) NOT NULL,                       -- Platform asal (contoh: lazada, shopee, facebook)
    
    -- Facebook post data
    fb_post_id VARCHAR(255),                                     -- ID catatan Facebook
    fb_comment_id VARCHAR(255),                                  -- ID comment Facebook (jika ada)
    fb_post_status VARCHAR(20) DEFAULT 'pending',                -- published, failed, pending
    fb_post_error TEXT,                                          -- Ralat jika terdapat
    fb_post_timestamp TIMESTAMP WITH TIME ZONE,                -- Tarikh posting Facebook
    fb_post_url TEXT,                                           -- URL kepada catatan Facebook
    
    -- Data produk berkaitan (untuk konteks sejarah)
    product_title TEXT,
    product_price DECIMAL(10,2),
    product_original_price DECIMAL(10,2),
    product_image_url TEXT,
    product_affiliate_url TEXT,
    product_category VARCHAR(100),
    product_rating DECIMAL(3,2),
    product_sold_count VARCHAR(50),
    
    -- Metadata penyiaran
    post_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Waktu pekerja berjaya log penyiaran
    campaign_type VARCHAR(50) DEFAULT 'dual_post',              -- 'dual_post', 'single_post', 'retry_attempt'
    retry_count INTEGER DEFAULT 0,                                -- Bilangan percubaan penyiaran semula
    error_details JSONB DEFAULT '{}'::jsonb,                      -- Segala data ralat tambahan
    
    -- Jejaring keselamatan akses
    created_by VARCHAR(100) DEFAULT 'system',                     -- Siapa yang mencetus log (system, worker, manual)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Jejaring keselamatan: Hubungan terperinci dengan posted_products
    FOREIGN KEY (product_id) REFERENCES posted_products(product_id) ON DELETE CASCADE
);

-- Indeks pantas untuk carian lazim
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_log_id ON facebook_post_logs (log_id);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_product_id ON facebook_post_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_platform ON facebook_post_logs (platform);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_fb_post_status ON facebook_post_logs (fb_post_status);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_fb_post_timestamp ON facebook_post_logs (fb_post_timestamp);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_source_platform ON facebook_post_logs (source_platform);
CREATE INDEX IF NOT EXISTS idx_facebook_post_logs_created_at ON facebook_post_logs (created_at);

-- Jejaring keselamatan: Pastikan setiap kombinasi unik log_id adalah unik
CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_post_logs_log_id_unique ON facebook_post_logs (log_id);

-- Jejaring keselamatan: Hanya pentadbir dan worker dibenarkan untuk menulis/mengubah data facebook_post_logs
ALTER TABLE facebook_post_logs ENABLE ROW LEVEL SECURITY;

-- Polisi keamanan: Hanya pentadbir dibenarkan untuk memasukkan entri baru
CREATE POLICY "admin_insert_facebook_post_logs" ON facebook_post_logs
  FOR INSERT WITH CHECK (current_setting('app.role') = 'admin' OR current_setting('app.role') = 'worker');

-- Polisi keamanan: Hanya pentadbir dibenarkan untuk mengubah entri lama
CREATE POLICY "admin_update_facebook_post_logs" ON facebook_post_logs
  FOR UPDATE USING (current_setting('app.role') = 'admin' OR current_setting('app.role') = 'worker');

-- Polisi keamanan: Pentadbir dan worker dibenarkan untuk membaca semua data
CREATE POLICY "admin_select_facebook_post_logs" ON facebook_post_logs
  FOR SELECT USING (current_setting('app.role') = 'admin' OR current_setting('app.role') = 'worker');

-- Polisi keamanan: Hanya pentadbir dibenarkan untuk menghapus entri
CREATE POLICY "admin_delete_facebook_post_logs" ON facebook_post_logs
  FOR DELETE USING (current_setting('app.role') = 'admin');

-- Comment table for future usage
COMMENT ON TABLE facebook_post_logs IS 'Jadual untuk mengesanyek setiap penyiaran Facebook, termasuk post, comment, dan ralat';

COMMENT ON COLUMN facebook_post_logs.log_id IS 'ID log unik: gabungan platform+product+tarikh';
COMMENT ON COLUMN facebook_post_logs.product_id IS 'Rujukan ke produk yang post';
COMMENT ON COLUMN facebook_post_logs.platform IS 'Platform asal produk: laz (Lazada), shp (Shopee), atau fcb (Facebook)';
COMMENT ON COLUMN facebook_post_logs.source_platform IS 'Platform asal nyatakan: lazada, shopee, facebook';
COMMENT ON COLUMN facebook_post_logs.fb_post_id IS 'ID catatan Facebook';
COMMENT ON COLUMN facebook_post_logs.fb_comment_id IS 'ID comment Facebook';
COMMENT ON COLUMN facebook_post_logs.fb_post_status IS 'Status penyiaran: published, failed, pending';
COMMENT ON COLUMN facebook_post_logs.fb_post_error IS 'Ralat teks penuh jika occurred';
COMMENT ON COLUMN facebook_post_logs.fb_post_timestamp IS 'Tarikh dan masa tepat tanda Facebook';
COMMENT ON COLUMN facebook_post_logs.fb_post_url IS 'URL kepada catatan Facebook yang boleh dilihat';
COMMENT ON COLUMN facebook_post_logs.campaign_type IS 'Jenis kempen penyiaran';
COMMENT ON COLUMN facebook_post_logs.retry_count IS 'Bilangan percubaan penyiaran semula';
COMMENT ON COLUMN facebook_post_logs.created_by IS 'Bagaimana log dicipta: system, worker, manual';

-- Triger untuk mengemaskini updated_at apabila data diubah
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_facebook_post_logs_updated_at
BEFORE UPDATE ON facebook_post_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Triger untuk membina log_id unik apabila data ditambah
CREATE OR REPLACE FUNCTION generate_facebook_post_logs_log_id()
RETURNS TRIGGER AS $$
DECLARE
    base_id VARCHAR(255);
    counter INTEGER;
BEGIN
    -- Jana log_id: platform-productId-timestamp-counter
    base_id := NEW.platform || '-' || NEW.product_id || '-' || TO_CHAR(NOW(), 'YYYYMMDD-HHmmss');
    
    -- Periksa kes terpakai
    SELECT COUNT(*) INTO counter
    FROM facebook_post_logs
    WHERE log_id LIKE base_id || '%';
    
    IF counter > 0 THEN
        NEW.log_id := base_id || '-' || (counter + 1);
    ELSE
        NEW.log_id := base_id || '-1';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_facebook_post_logs_generate_log_id
BEFORE INSERT ON facebook_post_logs
FOR EACH ROW
EXECUTE FUNCTION generate_facebook_post_logs_log_id();

-- Penyimpulan: Migrasi berjaya!
COMMENT ON TABLE facebook_post_logs IS 'Jadual log lengkap penyiaran Facebook untuk dual-channel posting. Mengesanyek setiap post, comment, dan ralat untuk penyeliaan dan analisis.

Sudah siap untuk eksekusi dengan worker penyebaran Supabase. Mencakup platform laz (Lazada), shp (Shopee), dan fcb (Facebook) untuk pengesanan prestasi penuh.';