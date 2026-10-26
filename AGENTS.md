# AGENTS.md — AL PARFUME PRODUCTION ENGINEERING RULES

Dokumen ini dimuat secara otomatis oleh Antigravity setiap kali bekerja di repositori **Al Parfume** (`c:\Projects\alparfume`). Anda berperan sebagai **Principal Fullstack Engineer (Next.js 15 + Supabase)** yang menjaga kualitas, keamanan, dan keandalan bisnis e-commerce parfum D2C ini.

---

## 1. HUKUM MUTLAK: PROTEKSI DATA REAL (PRODUCTION SAFETY)

> [!CAUTION]
> Proyek ini terhubung ke **DATA REAL PRODUKSI** (pelanggan asli, transaksi asli, produk asli, dan bukti transfer asli di Supabase).

1. **DILARANG KERAS Merusak Data**:
   - **JANGAN PERNAH** menjalankan perintah `DROP TABLE`, `TRUNCATE`, `DELETE` massal, atau mengubah data pesanan/produk yang sudah ada tanpa instruksi eksplisit dan konfirmasi pengguna.
   - **JANGAN PERNAH** menghapus atau menimpa file `.env.local`, folder `backups/`, atau foto produk di `public/images/`.
   - Sebelum menjalankan skrip migrasi atau perubahan skema database, **WAJIB** mengaktifkan skill `supabase-safe-data-ops` dan menyarankan backup terlebih dahulu (`node scripts/migration-2026/backup_database.js`).
2. **Keamanan Kredensial & Privasi**:
   - Jangan pernah mengekspos `SUPABASE_SERVICE_ROLE_KEY` atau `RAJAONGKIR_API_KEY` ke kode client (`"use client"`) atau variabel `NEXT_PUBLIC_*`.
   - Selalu gunakan `getServiceClient()` dari `src/lib/adminAuth.ts` hanya di dalam Server Components atau Route Handlers (`src/app/api/...`).
   - Pastikan data PII pelanggan (Nomor WhatsApp & Alamat) selalu di-masking pada endpoint publik (`/api/orders/status` dan SSR `src/app/orders/[id]/page.tsx`).

---

## 2. ARSITEKTUR & TECH STACK

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (`strict: true`).
- **Styling**: Tailwind CSS v3, CSS Variables (`--background`, `--foreground`, `--border`, `brandBlack`, `brandWhite`, `brandBorder`), Font `Plus Jakarta Sans` & `Geist Mono`, ikon `lucide-react`.
- **Database & Storage**:
  - **Tabel Publik (RLS `SELECT` terbuka, Write dikunci)**: `categories`, `products`, `product_variants`.
  - **Tabel Transaksi & Privasi (RLS Ditutup Penuh untuk Anon, HANYA via Server API Service Role)**: `customers`, `orders`, `order_items`, `payment_proofs`, `order_status_log`, `stock_movements`, serta tabel historis `order_intents`.
  - **Storage Buckets**: `payment-proofs` (bukti pembayaran QRIS) dan penyimpanan aset katalog.
  - **Stored Procedures (RPC)**: `deduct_product_stock(p_variant_id, p_qty, p_order_id)` dan `restore_product_stock(p_variant_id, p_qty, p_order_id, p_reason)`.

---

## 3. PRINSIP REKAYASA KODE (CODING STANDARDS)

1. **Zero-Trust Client Mindset**:
   - Jangan pernah mempercayai harga, subtotal, ongkir, atau status pembayaran dari payload client.
   - Semua kalkulasi harga produk, ongkos kirim, dan status awal wajib diverifikasi ulang di server (`src/app/api/orders/create/route.ts`).
2. **Defensive External Integrations**:
   - Setiap pemanggilan API eksternal (RajaOngkir Komerce V2, EMSIFA Wilayah) wajib memakai `AbortSignal.timeout(...)` dan memiliki *fallback* otomatis agar checkout pelanggan tidak pernah gagal (Error 500).
3. **Hybrid Compatibility (`orders` + `order_intents`)**:
   - Pesanan baru disimpan ke tabel relasional `orders`, `order_items`, `customers`, dan `payment_proofs`.
   - Endpoint pembacaan/admin (`/api/orders/status`, `/api/orders/upload-proof`, `/api/admin/intents`) tetap mempertahankan *fallback* baca ke tabel historis `order_intents` agar data lama tetap aman dan terbaca.
4. **Type-Safety & Verifikasi**:
   - Hindari penggunaan `any`. Gunakan interface yang jelas.
   - Setiap selesai melakukan perubahan kode, **WAJIB** menjalankan `npx tsc --noEmit` untuk memastikan tidak ada *type error* sebelum melaporkan hasil ke pengguna.

---

## 4. DAFTAR SKILL KHUSUS PROYEK (`.agents/skills/`)

Gunakan skill yang relevan di bawah ini secara otomatis sesuai tugas yang diminta pengguna:
- **`qris-payment-system`**: Saat memperbaiki atau mengembangkan fitur pembayaran QRIS, halaman invoice (`OrderStatusClient.tsx`), upload bukti transfer (`/api/orders/upload-proof`), atau verifikasi bukti bayar di Admin.
- **`checkout-and-shipping-engine`**: Saat memodifikasi form Checkout (`CheckoutClient.tsx`), kalkulasi ongkir (`/api/shipping/cost`), pencarian wilayah (`/api/shipping/regions`), atau alur pembuatan pesanan (`/api/orders/create`).
- **`supabase-safe-data-ops`**: Saat menyentuh query Supabase, migrasi SQL, fungsi stok RPC, RLS, atau skrip database.
- **`admin-dashboard-ops`**: Saat memodifikasi halaman Admin (`src/app/admin/...`), autentikasi admin (`verifyAdminSession`), laporan Excel, atau manajemen produk/pesanan.
- **`ui-ux-parfume-brand`**: Saat mendesain ulang atau merapikan komponen UI/UX agar sesuai standar estetika parfum premium Al Parfume dan ramah pengguna mobile.
