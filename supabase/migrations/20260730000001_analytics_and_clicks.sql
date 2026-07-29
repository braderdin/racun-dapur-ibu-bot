-- ============================================================================
-- Nama Migrasi: 20260730000001_analytics_and_clicks.sql
-- Masa: 2026-07-30
-- Tujuan: Buat jadual `link_clicks` untuk menjejak prestasi shortener URL (clicks & conversion)
--          serta indeks supaya carian data pantas.
-- ============================================================================

-- Perintis jadual utama click tracking
CREATE TABLE IF NOT EXISTS link_clicks (
  id bigserial PRIMARY KEY,
  short_code VARCHAR(10) NOT NULL,               -- Kod short code (seperti /r/abc123)
  affiliate_url TEXT NOT NULL,                    -- URL afiliasi asal
  product_id VARCHAR(255),                        -- Rujukan ke posted_products.id (pilihan)
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,                                 -- Agnostik (boleh null)
  ip_address INET,                                 -- Perlindungan ringkas
  referred_from TEXT,                             -- Medan rujukan (contoh: page asal)
  conversion_result BOOLEAN DEFAULT false,         -- Sama ada klik diubah kepada pembelian (kemudian diproses oleh worker)
  metadata JSONB DEFAULT '{}'::jsonb,            -- Data tambahan (contoh: UTM parameters)
  -- Foreign key (pilihan) ke posted_products
  CONSTRAINT fk_product_link_clicks
    FOREIGN KEY (product_id) REFERENCES posted_products(product_id)
    ON DELETE SET NULL
);

-- Indeks pantas untuk carian cacular
CREATE INDEX IF NOT EXISTS idx_link_clicks_short_code ON link_clicks (short_code);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks (clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_product_id ON link_clicks (product_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_conversion_result ON link_clicks (conversion_result);
CREATE INDEX IF NOT EXISTS idx_link_clicks_ip_address ON link_clicks (ip_address);
CREATE INDEX IF NOT EXISTS idx_link_clicks_referred_from ON link_clicks (referred_from);

-- Indeks unik tidak penting: pastikan setiap short_code muncul hanya sekali jika diperlukan
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_clicks_short_code_unique ON link_clicks (short_code) WHERE conversion_result = true;

-- Jejaring keselamatan: Hanya pentadbir yang dibenarkan mengedit data
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Tiada dasar PENTADB diperlukan secara terperinci; anda boleh memilih untuk mengehadkan akses kepada peranan khusus
-- Contohnya:
-- CREATE POLICY "admin_insert_link_clicks" ON link_clicks
--   FOR INSERT WITH CHECK (current_setting('app.role') = 'admin');
-- CREATE POLICY "admin_select_link_clicks" ON link_clicks
--   FOR SELECT USING (current_setting('app.role') = 'admin');

-- Comment table for future usage
COMMENT ON TABLE link_clicks IS 'Catatan tracking klik URL shortener dan metrik conversion';
COMMENT ON COLUMN link_clicks.short_code IS 'Kod short code unik';
COMMENT ON COLUMN link_clicks.affiliate_url IS 'Pautan afiliasi yang dirujuk';
COMMENT ON COLUMN link_clicks.product_id IS 'Rujukan ke produk yang menyebabkan klik';
COMMENT ON COLUMN link_clicks.clicked_at IS 'Tarikh dan masa klik';