-- ============================================================================
-- Nama Migrasi: 20260730000002_dual_engine_and_click_analytics.sql
-- Masa: 2026-07-30
-- Tujuan: Tambah jadual `click_analytics` untuk menjejak prestasi klik & konversi dari shortener
--          serta menambah field dual-engine dan WebP ke posted_products.
-- ============================================================================

-- Tambah enum untuk kedua-dua platform e-dagang (Lazada, Shopee)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform') THEN
        CREATE TYPE platform AS ENUM ('lazada', 'shopee');
    END IF;
END$$;

-- Tambah jadual click_analytics untuk menjejak prestasi shortener URL
CREATE TABLE IF NOT EXISTS click_analytics (
    id bigserial PRIMARY KEY,
    short_code VARCHAR(10) NOT NULL,               -- Kod short code (seperti /r/abc123)
    affiliate_url TEXT NOT NULL,                    -- URL afiliasi asal
    product_id VARCHAR(255),                        -- Rujukan ke posted_products.id (pilihan)
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,                                 -- Agnostik (boleh null)
    ip_address INET,                                 -- Perlindungan ringkas
    referred_from TEXT,                            -- Medan rujukan (contoh: page asal)
    conversion_result BOOLEAN DEFAULT false,        -- Sama ada klik diubah kepada pembelian (kemudian diproses oleh worker)
    metadata JSONB DEFAULT '{}'::jsonb,            -- Data tambahan (contoh: UTM parameters)
    platform platform,                               -- Dual-engine integration: platform asalnya (lazada/shopee)
    image_webp_url TEXT,                             -- Store WebP version URL for image compression feature
    FOREIGN KEY (product_id) REFERENCES posted_products(product_id) ON DELETE SET NULL
);

-- Indeks pantas untuk carian cacular
CREATE INDEX IF NOT EXISTS idx_click_analytics_short_code ON click_analytics (short_code);
CREATE INDEX IF NOT EXISTS idx_click_analytics_clicked_at ON click_analytics (clicked_at);
CREATE INDEX IF NOT EXISTS idx_click_analytics_product_id ON click_analytics (product_id);
CREATE INDEX IF NOT EXISTS idx_click_analytics_conversion_result ON click_analytics (conversion_result);
CREATE INDEX IF NOT EXISTS idx_click_analytics_ip_address ON click_analytics (ip_address);
CREATE INDEX IF NOT EXISTS idx_click_analytics_referred_from ON click_analytics (referred_from);
CREATE INDEX IF NOT EXISTS idx_click_analytics_platform ON click_analytics (platform);
CREATE INDEX IF NOT EXISTS idx_click_analytics_image_webp_url ON click_analytics (image_webp_url);

-- Jejaring keselamatan: Hanya pentadbir yang dibenarkan mengedit data
ALTER TABLE click_analytics ENABLE ROW LEVEL SECURITY;

-- Tiada dasar PENTADB diperlukan secara terperinci; anda boleh memilih untuk mengehadkan akses kepada peranan khusus
-- Contohnya:
-- CREATE POLICY "admin_insert_click_analytics" ON click_analytics
--   FOR INSERT WITH CHECK (current_setting('app.role') = 'admin');
-- CREATE POLICY "admin_select_click_analytics" ON click_analytics
--   FOR SELECT USING (current_setting('app.role') = 'admin');

-- Comment table for future usage
COMMENT ON TABLE click_analytics IS 'Catatan tracking prestasi klik URL shortener dan metrik conversion';
COMMENT ON COLUMN click_analytics.short_code IS 'Kod short code unik';
COMMENT ON COLUMN click_analytics.affiliate_url IS 'Pautan afiliasi yang dirujuk';
COMMENT ON COLUMN click_analytics.product_id IS 'Rujukan ke produk yang menyebabkan klik';
COMMENT ON COLUMN click_analytics.clicked_at IS 'Tarikh dan masa klik';
COMMENT ON COLUMN click_analytics.platform IS 'Platform asal produk: laz (Lazada) atau shp (Shopee)';
COMMENT ON COLUMN click_analytics.image_webp_url IS 'URL WebP yang dimampat; dinaik naik oleh worker B2 dengan extension .webp';

-- Tambah field dual-engine ke posted_products
ALTER TABLE posted_products
ADD COLUMN IF NOT EXISTS platform platform,
ADD COLUMN IF NOT EXISTS image_webp_url TEXT,
ADD COLUMN IF NOT EXISTS shopee_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS shopee_item_id VARCHAR(255);

-- Indeks untuk penyemakan sejarah produk yang disebabkan oleh product_id yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_posted_products_product_id_unique ON posted_products (product_id) WHERE posted_at > (CURRENT_TIMESTAMP - INTERVAL '5 days');

-- Indeks untuk penyemakan isi kandungan (jika diperlukan)
CREATE INDEX IF NOT EXISTS idx_posted_products_shopee_item_id ON posted_products (shopee_item_id);

-- Jejaring keselamatan: Pastikan setiap product_id tidak mempunyai lebih daripada satu entri untuk tempoh 5 hari
-- (Oleh kerana pemantauan dilaksanakan di tahap aplikasi dengan Upstash Redis, jejaring keselamatan ini sebagai langkah kedua)

-- Jejaring keselamatan: Hanya pengguna pentadbir yang dibenarkan untuk memasukkan/entri data
ALTER TABLE posted_products ENABLE ROW LEVEL SECURITY;

-- Tiada dasar PENTADB diperlukan secara terperinci; anda boleh memilih untuk mengehadkan akses kepada peranan khusus
-- Contohnya:
-- CREATE POLICY "admin_insert_posted_products" ON posted_products
--   FOR INSERT WITH CHECK (current_setting('app.role') = 'admin');
-- CREATE POLICY "admin_update_posted_products" ON posted_products
--   FOR UPDATE USING (current_setting('app.role') = 'admin');
-- CREATE POLICY "admin_select_posted_products" ON posted_products
--   FOR SELECT USING (current_setting('app.role') = 'admin');

-- Menyediakan petikan untuk kegunaan masa depan
COMMENT ON COLUMN posted_products.platform IS 'Platform asal produk: laz (Lazada) atau shp (Shopee)';
COMMENT ON COLUMN posted_products.image_webp_url IS 'URL WebP yang dimampat; dinaik naik oleh worker B2';
COMMENT ON COLUMN posted_products.shopee_product_id IS 'Product ID Shopee (berbeza daripada lazada_product_id)';
COMMENT ON COLUMN posted_products.shopee_item_id IS 'Item ID Shopee (berbeza daripada lazada_item_id)';