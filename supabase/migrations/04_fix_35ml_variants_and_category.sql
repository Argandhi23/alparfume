-- ========================================================
-- AL PARFUME - UPDATE 30ML TO 35ML VARIANTS AND CATEGORY (04)
-- Mengoreksi ukuran varian 30ml menjadi 35ml dan update nama/slug kategori
-- ========================================================

-- 1. Update 5 varian produk dari size_ml = 30 menjadi 35
UPDATE product_variants
SET size_ml = 35
WHERE size_ml = 30;

-- 2. Update nama dan slug kategori 'Variant 30 ml' menjadi 'Variant 35 ml'
UPDATE categories
SET name = 'Variant 35 ml',
    slug = 'variant-35ml'
WHERE id = '82108b95-6071-499c-8741-e1852ac24163';
