---
name: supabase-safe-data-ops
description: >-
  Use this skill before creating or modifying any Supabase database queries,
  SQL migrations, RLS policies, RPC functions, or running database scripts
  in c:\Projects\alparfume. Enforces strict production data safety.
---

# Supabase Safe Data Operations Skill

Proyek **Al Parfume** menggunakan database produksi aktif di Supabase. Skill ini memastikan tidak ada data pelanggan, pesanan, atau katalog produk yang rusak.

## 1. Struktur Skema Database Saat Ini

1. **Katalog Publik (RLS: `SELECT` publik diizinkan, Write hanya via Service Role / Admin)**:
   - `categories` (`id` UUID, `name`, `slug`, `image_url`, `bg_color`, `sort_order`)
   - `products` (`id` UUID, `name`, `slug`, `description`, `top_notes`, `middle_notes`, `bottom_notes`, `image_url`, `category_id`, `is_active`, `is_sold_out`, `is_best_seller`, `stock`, `shopee_link`)
   - `product_variants` (`id` UUID, `product_id` UUID, `size_ml` INT, `price` NUMERIC, `stock` INT)
2. **Transaksi & Audit (RLS: Ditutup Penuh untuk Anon; Akses HANYA via `getServiceClient()`)**:
   - `customers` (`id` UUID, `name`, `wa_number`, `address`)
   - `orders` (`id` BIGINT, `order_code` VARCHAR UNIQUE, `customer_id` UUID, `subtotal`, `shipping_cost`, `delivery_method`, `grand_total`, `payment_method`, `payment_status`, `fulfillment_status`, `tracking_number`, `order_notes`)
   - `order_items` (`id` UUID, `order_id` BIGINT, `variant_id` UUID, `product_name_snapshot`, `size_ml_snapshot`, `qty`, `price_snapshot`, `total_price`)
   - `payment_proofs` (`id` UUID, `order_id` BIGINT, `image_url`, `verified_by`, `verified_at`)
   - `order_status_log` (`id` UUID, `order_id` BIGINT, `status_type`, `status_value`, `changed_by`, `changed_at`)
   - `stock_movements` (`id` UUID, `variant_id` UUID, `change_qty`, `reason`, `reference_order_id`)
   - `order_intents` (Tabel historis/legacy yang tetap dipertahankan sebagai *read/update fallback*).

## 2. Protokol Keamanan Database

1. **Wajib Backup Sebelum Migrasi**:
   - Sebelum menjalankan perubahan skema atau skrip migrasi data, jalankan:
     `node scripts/migration-2026/backup_database.js`
   - Pastikan file backup JSON baru terbentuk di folder `backups/`.
2. **SQL Idempotent & Non-Destruktif**:
   - Selalu gunakan `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, dan `CREATE INDEX IF NOT EXISTS`.
   - **DILARANG** menjalankan `DROP TABLE`, `DROP COLUMN`, atau `TRUNCATE` pada tabel produksi.
3. **Operasi Stok Wajib Atomik**:
   - Gunakan RPC `deduct_product_stock` saat mengurangi stok dan `restore_product_stock` saat membatalkan pesanan yang sudah lunas.
4. **Sinkronisasi TypeScript (`src/lib/supabase.ts`)**:
   - Saat menambah kolom baru, perbarui interface di [src/lib/supabase.ts](../../src/lib/supabase.ts) tanpa menghapus properti opsional yang masih dipakai oleh komponen lama.
