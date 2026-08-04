-- ========================================================
-- AL PARFUME - PERFORMANCE INDEXES MIGRATION (02)
-- Optimasi query katalog produk dan dashboard / filter order
-- ========================================================

-- Index untuk filter status keaktifan produk (katalog publik)
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Index untuk filter kategori produk (katalog publik / dropdown)
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Index untuk filter ketersediaan produk (sold out vs available)
CREATE INDEX IF NOT EXISTS idx_products_sold_out ON products(is_sold_out);

-- Composite Index untuk pencarian & filtering status transaksi (payment_status & fulfillment_status)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status, fulfillment_status);

-- Index untuk pengurutan & kueri transaksi berdasarkan rentang waktu (created_at)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
