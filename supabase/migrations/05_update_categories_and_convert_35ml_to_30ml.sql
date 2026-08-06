-- ========================================================
-- AL PARFUME - MIGRATION 05: UPDATE CATEGORIES & CONVERT 35ML TO 30ML (FIXED)
-- ========================================================

-- 1. Update ukuran varian dari 35ml menjadi 30ml
UPDATE product_variants
SET size_ml = 30
WHERE size_ml = 35;

-- 2. Memastikan 4 Kategori Utama Berdasarkan Konsentrasi Parfum Ada di Tabel categories
-- (Menggunakan ON CONFLICT (id) agar aman jika ID kategori sudah ada di live DB)

-- A. Kategori Sample
INSERT INTO categories (id, name, slug, image_url, sort_order)
VALUES ('4ed0369c-e713-47d0-9e20-c267c05833c7', 'Sample', 'sample', NULL, 1)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order;

-- B. Kategori Eau de Toilette (Termasuk alokasi produk 30ml)
INSERT INTO categories (id, name, slug, image_url, sort_order)
VALUES ('82108b95-6071-499c-8741-e1852ac24163', 'Eau de Toilette', 'eau-de-toilette', NULL, 2)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order;

-- C. Kategori Eau de Parfum
INSERT INTO categories (id, name, slug, image_url, sort_order)
VALUES ('e2e2e2e2-e2e2-11ee-8656-0242ac130002', 'Eau de Parfum', 'eau-de-parfum', NULL, 3)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order;

-- D. Kategori Extrait de Parfum
INSERT INTO categories (id, name, slug, image_url, sort_order)
VALUES ('e3e3e3e3-e3e3-11ee-8656-0242ac130002', 'Extrait de Parfum', 'extrait-de-parfum', NULL, 4)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    sort_order = EXCLUDED.sort_order;

-- 3. Update relasi category_id pada produk
-- A. Produk Sampel dialokasikan ke Kategori Sample
UPDATE products
SET category_id = '4ed0369c-e713-47d0-9e20-c267c05833c7'
WHERE LOWER(name) LIKE '%sample%' OR LOWER(slug) LIKE '%sample%';

-- B. Produk botol yang memiliki varian 30ml dialokasikan ke Eau de Toilette
UPDATE products
SET category_id = '82108b95-6071-499c-8741-e1852ac24163'
WHERE id IN (
    SELECT DISTINCT product_id 
    FROM product_variants 
    WHERE size_ml = 30
) AND (category_id IS NULL OR category_id != '4ed0369c-e713-47d0-9e20-c267c05833c7');

-- C. Produk botol lainnya tanpa category_id diset default ke Eau de Parfum
UPDATE products
SET category_id = 'e2e2e2e2-e2e2-11ee-8656-0242ac130002'
WHERE category_id IS NULL;

-- 4. Bersihkan kategori lama yang sudah tidak terpakai
DELETE FROM categories 
WHERE slug IN ('variant-35ml', 'variant-50ml', 'variant-100ml', '30ml', '35ml', '50ml', '100ml')
  AND id NOT IN (
    '4ed0369c-e713-47d0-9e20-c267c05833c7',
    '82108b95-6071-499c-8741-e1852ac24163',
    'e2e2e2e2-e2e2-11ee-8656-0242ac130002',
    'e3e3e3e3-e3e3-11ee-8656-0242ac130002'
  );
