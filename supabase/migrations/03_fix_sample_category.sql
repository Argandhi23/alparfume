-- ========================================================
-- AL PARFUME - UPDATE SAMPLE CATEGORY IDS (03)
-- Menghubungkan 8 produk sample ke UUID Kategori Sample
-- ========================================================

UPDATE products
SET category_id = '4ed0369c-e713-47d0-9e20-c267c05833c7'
WHERE id IN (
    '05c7b6de-835f-4291-ae66-3c20bca17f0b', -- Best Seller Sample
    '657d7eb2-eec1-45cd-9d79-7a38217f6660', -- Sample All Variant
    '0079ddc4-7a13-4dca-a9ec-6e6b8ef0ebef', -- Sample Elysian Vanilla - 10 ML
    '060a0b4a-2111-4ddf-a5e5-a3d38155a726', -- Sample Merry Kiss - 10 ML
    'ff0433ad-e4aa-47b8-b0f8-8872d7260169', -- Sample Pink Romance - 10 ML
    'e6bb9ac2-32d6-4fa1-90b8-14046fcf855c', -- Sample Guavin - 10 ML
    'a0d306dc-d33d-476d-84f1-7a8f136bf552', -- Sample Serenity - 10 ML
    '843b4eac-bf72-4ec7-8d7c-99eec6365532'  -- SUGUS
);
