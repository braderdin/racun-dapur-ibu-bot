-- ============================================================================
-- Nama Migrasi: 20260730000000_init_posted_products.sql
-- Masa: 2026-07-30
-- Tujuan: Inisialisasi jadual `posted_products` untuk menjejak sejarah penghantaran produk
-- ============================================================================

-- Memastikan extension pgvector aktif (jika diperlukan untuk similarity search)
CREATE EXTENSION IF NOT EXISTS pgvector WITH SCHEMA public;

-- Jadual utama untuk menjejak produk yang telah diposting
CREATE TABLE IF NOT EXISTS posted_products (
  id bigserial PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  product_title TEXT,
  product_price DECIMAL(10, 2),
  product_image_url TEXT,
  affiliate_url TEXT NOT NULL,
  lazada_product_id VARCHAR(255) UNIQUE,
  lazada_item_id VARCHAR(255) UNIQUE,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  tweet_id VARCHAR(50), -- ID tweet X (Twitter) yang pertama
  reply_tweet_id VARCHAR(50), -- ID tweet balasan
  copy_used TEXT, -- Menyimpan snapshot ayat yang digunakan (JSON)
  x_user_id VARCHAR(50), -- ID pengguna X
  x_username TEXT, -- Username pengguna X
  x_display_name TEXT, -- Nama paparan pengguna X
  tags_used JSONB DEFAULT '[]'::jsonb,
  sentiment_score DECIMAL(3, 2), -- Skor sentimen AI untuk ayat yang dijana
  image_storage_used JSONB DEFAULT '{}'::jsonb, -- Menyimpan metadata penyimpanan B2 (contoh: { "account": "1", "bucket": "..., "object": "..." })
);

-- Indeks untuk penghantaran yang kerap (anti-spam, semakan pantas)
CREATE INDEX IF NOT EXISTS idx_posted_products_product_id ON posted_products (product_id);
CREATE INDEX IF NOT EXISTS idx_posted_products_posted_at ON posted_products (posted_at);

-- Indeks untuk penyemakan sejarah produk yang disebabkan oleh product_id yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_posted_products_product_id_unique ON posted_products (product_id) WHERE posted_at > (CURRENT_TIMESTAMP - INTERVAL '5 days');

-- Indeks untuk penyemakan isi kandungan (jika diperlukan)
CREATE INDEX IF NOT EXISTS idx_posted_products_lazada_item_id ON posted_products (lazada_item_id);

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
COMMENT ON TABLE posted_products IS 'Catatan kekal bagi setiap produk yang telah diposting oleh bot X @RacunDapurIbu';
COMMENT ON COLUMN posted_products.product_id IS 'ID unik produk (dikumpul dari API Lazada)';
COMMENT ON COLUMN posted_products.posted_at IS 'Tarikh dan masa penghantaran produk ke X';
COMMENT ON COLUMN posted_products.image_storage_used IS 'JSON menyimpan metadata akaun Backblaze B2 yang digunakan';
