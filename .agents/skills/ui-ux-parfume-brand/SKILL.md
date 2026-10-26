---
name: ui-ux-parfume-brand
description: >-
  Use this skill when designing, styling, refactoring, or fixing UI components
  and pages in Al Parfume to maintain its luxury D2C perfume aesthetic,
  responsive mobile-first layout, and dark/light theme compatibility.
---

# Al Parfume UI/UX & Brand Design System Skill

Skill ini memastikan seluruh antarmuka **Al Parfume** tampil elegan, eksklusif, cepat, dan memiliki rasio konversi (*conversion rate*) tinggi di perangkat mobile maupun desktop.

## 1. Identitas Visual & Tokens

- **Tipografi**:
  - Heading & Brand: `font-plus-jakarta` (Plus Jakarta Sans) — tegas, bersih, modern.
  - Body: `font-sans`.
  - Kode Pesanan, Harga, Resi, & Angka: `font-mono` (Geist Mono) agar mudah dibaca dan sejajar.
- **Palet Warna & Tema**:
  - Mendukung tema dinamis melalui CSS Variables (`var(--background)`, `var(--background-secondary)`, `var(--foreground)`, `var(--text-muted)`, `var(--border)`) dan token Tailwind (`brandBlack`, `brandWhite`, `brandBorder`, `brandGray`).
  - Aksen status semantik:
    - Sukses / Lunas / Selesai / WhatsApp: `emerald-600` (`bg-emerald-50`, `text-emerald-700`, `border-emerald-200`).
    - Menunggu / Verifikasi / COD: `amber-500` / `amber-600` (`bg-amber-50`, `text-amber-800`, `border-amber-200`).
    - Error / Hapus / Habis: `rose-600` (`bg-rose-50`, `text-rose-600`, `border-rose-200`).
- **Komponen & Sudut**:
  - Kartu utama menggunakan `rounded-2xl` atau `rounded-3xl` dengan border halus (`border-brandBorder` atau `border-[var(--border)]`) dan bayangan lembut (`shadow-xs` / `shadow-sm`).

## 2. Prinsip Mobile-First E-Commerce

1. **Zero Friction pada Alur Beli**:
   - Tombol aksi utama (*Beli Sekarang*, *Proses Pesanan*, *Unduh QRIS*, *Unggah Bukti Transfer*) harus memiliki area sentuh (*tap target*) minimal `44px` di layar HP.
   - Setiap proses *async* (hitung ongkir, submit order, kompresi & upload gambar) wajib menampilkan indikator `Loader2` (`animate-spin`) dan men-disable tombol agar tidak terjadi *double-submit*.
2. **Format Mata Uang & Bahasa**:
   - Selalu gunakan Bahasa Indonesia yang sopan, jelas, dan profesional.
   - Format harga wajib menggunakan Rupiah tanpa angka desimal (`Rp 45.000`).
3. **Optimasi Gambar**:
   - Gunakan helper `sanitizeImageUrl` dari [src/lib/imageHelper.ts](../../src/lib/imageHelper.ts) untuk gambar produk eksternal/Supabase.
   - Untuk upload foto dari pengguna (bukti bayar) atau admin (foto produk), selalu lakukan kompresi `<canvas>` di sisi client sebelum dikirim ke server agar hemat kuota Supabase Storage dan cepat di jaringan seluler.
