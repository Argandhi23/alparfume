-- ========================================================
-- AL PARFUME - SUPABASE MIGRATION: TABEL TESTIMONIALS / ULASAN
-- ========================================================

CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    customer_avatar_url TEXT,
    rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name_override VARCHAR(255),
    review_text TEXT NOT NULL,
    tag VARCHAR(100),
    image_url TEXT,
    is_verified_buyer BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_testimonials_active_sort ON testimonials (is_active, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_product_id ON testimonials (product_id);

-- Row Level Security (RLS)
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'testimonials' AND policyname = 'Public read active testimonials') THEN
        CREATE POLICY "Public read active testimonials" ON testimonials FOR SELECT USING (is_active = true);
    END IF;
END $$;
