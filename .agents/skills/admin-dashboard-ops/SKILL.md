---
name: admin-dashboard-ops
description: >-
  Use this skill when working on the Al Parfume Admin Portal
  (src/app/admin/... and src/app/api/admin/...), including order management,
  payment verification, resi input, Excel export, product/category CRUD,
  analytics stats, or admin authentication.
---

# Admin Dashboard & Operations Skill

Skill ini mengatur pengembangan dan perbaikan pada portal Admin **Al Parfume**.

## 1. Peta Modul Admin

- **Autentikasi & Helper Server**:
  - [src/lib/adminAuth.ts](../../src/lib/adminAuth.ts): Fungsi `verifyAdminSession(request)` (memvalidasi JWT Bearer token Supabase Auth) dan `getServiceClient()`.
- **Halaman Admin (`src/app/admin/(dashboard)/`)**:
  - `dashboard/page.tsx` & [src/components/DashboardCharts.tsx](../../src/components/DashboardCharts.tsx): Ringkasan pendapatan, grafik penjualan, dan metrik pesanan.
  - `orders/page.tsx`: Manajemen pesanan, filter status/tanggal/pengiriman, verifikasi bukti QRIS, input nomor resi, integrasi chat WhatsApp otomatis, dan ekspor laporan Excel.
  - `products/page.tsx`: CRUD produk & varian ukuran (`10ml`/`18ml`/`20ml`/`30ml`), stok, foto produk (dengan `ImageCropperModal.tsx`), dan badge *Best Seller* / *Sold Out*.
  - `categories/page.tsx`: CRUD kategori parfum.
  - `settings/page.tsx`: Pengaturan kredensial akun admin & konfigurasi toko.
- **Endpoint API Admin (`src/app/api/admin/`)**:
  - `intents/route.ts`: `GET` (paginasi pesanan), `PATCH` (update status bayar/fulfillment/resi + potong/kembalikan stok otomatis + catat `order_status_log` + `revalidatePath`), `DELETE` (hapus pesanan).
  - `intents/delete-proof/route.ts`: Hapus bukti transfer dari bucket `payment-proofs` dan tabel `payment_proofs`.
  - `stats/route.ts`: Kalkulasi analitik dashboard admin.
  - `revalidate/route.ts`: On-demand ISR cache revalidation untuk halaman katalog publik.

## 2. Standar Pengembangan Fitur Admin

1. **Wajib Bearer Token Auth**:
   - Setiap request dari halaman Admin ke `/api/admin/...` wajib menyertakan header `Authorization: Bearer <session.access_token>`.
   - Jangan mengandalkan query langsung dari browser (`supabase.from("orders")`) untuk tabel yang dikunci RLS. Semua mutasi admin harus melewati `/api/admin/...` yang memanggil `verifyAdminSession`.
2. **Cache Revalidation Otomatis**:
   - Setiap kali admin mengubah data produk, harga varian, kategori, atau stok, panggil `revalidatePath("/")` dan `revalidatePath("/products/[slug]")` (atau panggil `/api/admin/revalidate`) agar katalog publik langsung ter-update.
3. **Audit Trail**:
   - Setiap perubahan `payment_status` atau `fulfillment_status` oleh admin di tabel `orders` wajib tercatat di `order_status_log` dengan `changed_by: adminEmail`.
