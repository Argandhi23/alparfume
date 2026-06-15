-- Seed initial products
INSERT INTO products (id, name, slug, description, notes, image_url, is_active, created_at) VALUES
('a1b1c1d1-e1f1-11ee-8656-0242ac130002', 'SERENITY', 'serenity', 'A calm and peaceful aroma that brings tranquility to your day.', '{"top": "Lavender, Bergamot", "middle": "Chamomile, Jasmine", "bottom": "Cedarwood, Musk"}', NULL, TRUE, NOW()),
('a2b2c2d2-e2f2-11ee-8656-0242ac130002', 'PINK ROMANCE', 'pink-romance', 'A sweet, floral fragrance capturing the essence of modern romance.', '{"top": "Red Apple, Pear", "middle": "Rose, Peony", "bottom": "Vanilla, White Musk"}', NULL, TRUE, NOW()),
('a3b3c3d3-e3f3-11ee-8656-0242ac130002', 'ELSYIAN VANILLA', 'elsyian-vanilla', 'Warm, comforting, and luxurious vanilla blend with a hint of spice.', '{"top": "Vanilla Orchid, Pear", "middle": "Brown Sugar, Tonka Bean", "bottom": "Amber, Patchouli"}', NULL, TRUE, NOW()),
('a4b4c4d4-e4f4-11ee-8656-0242ac130002', 'MERRY KISS', 'merry-kiss', 'Playful and energetic scent with vibrant fruity notes.', '{"top": "Strawberry, Raspberry", "middle": "Sweet Pea, Freesia", "bottom": "Sandalwood, Amber"}', NULL, TRUE, NOW()),
('a5b5c5d5-e5f5-11ee-8656-0242ac130002', 'GUAVIN', 'guavin', 'Refreshing and exotic blend with guava and tropical fruit notes.', '{"top": "Pink Guava, Passionfruit", "middle": "Hibiscus, Mango", "bottom": "Coconut, Driftwood"}', NULL, TRUE, NOW()),
('a6b6c6d6-e6f6-11ee-8656-0242ac130002', 'POCKET EDITION', 'pocket-edition', 'A compact, pocket-sized fragrance designed for fresh touch-ups on the go.', '{"top": "Citrus, Mint", "middle": "Green Tea, Ginger", "bottom": "Vetiver, Oakmoss"}', NULL, TRUE, NOW())
ON CONFLICT (slug) DO NOTHING;

-- Seed variants for products
INSERT INTO product_variants (product_id, size_ml, price) VALUES
-- SERENITY (35ml = Rp45000, 18ml = Rp25000)
('a1b1c1d1-e1f1-11ee-8656-0242ac130002', 35, 45000),
('a1b1c1d1-e1f1-11ee-8656-0242ac130002', 18, 25000),

-- PINK ROMANCE (35ml = Rp45000, 18ml = Rp25000)
('a2b2c2d2-e2f2-11ee-8656-0242ac130002', 35, 45000),
('a2b2c2d2-e2f2-11ee-8656-0242ac130002', 18, 25000),

-- ELSYIAN VANILLA (35ml = Rp45000, 18ml = Rp25000)
('a3b3c3d3-e3f3-11ee-8656-0242ac130002', 35, 45000),
('a3b3c3d3-e3f3-11ee-8656-0242ac130002', 18, 25000),

-- MERRY KISS (35ml = Rp45000, 18ml = Rp25000)
('a4b4c4d4-e4f4-11ee-8656-0242ac130002', 35, 45000),
('a4b4c4d4-e4f4-11ee-8656-0242ac130002', 18, 25000),

-- GUAVIN (35ml = Rp50000, 18ml = Rp30000)
('a5b5c5d5-e5f5-11ee-8656-0242ac130002', 35, 50000),
('a5b5c5d5-e5f5-11ee-8656-0242ac130002', 18, 30000),

-- POCKET EDITION (20ml = Rp20000)
('a6b6c6d6-e6f6-11ee-8656-0242ac130002', 20, 20000)
ON CONFLICT DO NOTHING;
