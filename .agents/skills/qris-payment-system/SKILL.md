---
name: qris-payment-system
description: >-
  Use this skill whenever the user asks to fix, improve, debug, or add features
  to QRIS payments, payment instructions, invoice/order status page (OrderStatusClient),
  payment proof image upload (/api/orders/upload-proof), dynamic QRIS generation,
  or admin payment verification in Al Parfume.
---

# QRIS Payment & Proof Verification System Skill

Skill ini berisi peta arsitektur, SOP teknis, dan daftar titik kritis untuk sistem pembayaran **QRIS** di proyek **Al Parfume**.

## 1. Peta File Terkait QRIS

1. **Engine QRIS Dinamis (EMVCo TLV + CRC16-CCITT)**:
   - [src/lib/qris.ts](../../src/lib/qris.ts): Menyimpan payload resmi **ALPARFUME.CO** (`NMID: ID1026602610382`, `A01`, Kota Madiun), fungsi `generateDynamicQrisPayload(amount)` (mengubah Tag `01` menjadi `12`, menyisipkan Tag `54` = nominal `grandTotal`, dan menghitung ulang Tag `63` CRC16-CCITT), serta `generateDynamicQrisTemplateDataUrl(amount)` yang merender QRIS Dinamis langsung di atas poster resmi `/public/qris.jpg`.
2. **Halaman Status & Pembayaran Pelanggan**:
   - [src/app/orders/[id]/page.tsx](../../src/app/orders/[id]/page.tsx): SSR pengambilan data pesanan (`orders` + join `customers`, `order_items`, `payment_proofs`, dengan fallback ke `order_intents`) serta masking PII (`maskWaNumber`, `maskAddress`).
   - [src/components/OrderStatusClient.tsx](../../src/components/OrderStatusClient.tsx): UI tampilan QRIS Dinamis (`/qris.jpg` sebagai fallback), tombol Unduh QRIS & Salin Nominal, modal zoom QRIS, kompresi gambar client-side via `<canvas>` (maks 800x800, JPEG quality 0.75), upload/re-upload bukti bayar, dan progres status pesanan.
2. **API Upload & Status Bukti Pembayaran**:
   - [src/app/api/orders/upload-proof/route.ts](../../src/app/api/orders/upload-proof/route.ts): Endpoint `POST` ber-rate-limit (10 req/menit). Menolak ID integer sekuensial (wajib `order_code` seperti `ORD-...`), memvalidasi ukuran base64 (< 7MB) & MIME (`jpeg|png|jpg|webp`), mengunggah file ke Supabase Storage bucket `payment-proofs`, menyimpan URL ke tabel `payment_proofs`, dan mengubah `orders.payment_status` menjadi `pending_verification`.
   - [src/app/api/orders/status/route.ts](../../src/app/api/orders/status/route.ts): Endpoint polling status pesanan publik (mengambil `payment_proofs` terbaru berdasarkan `created_at DESC`).
3. **Verifikasi & Manajemen Bukti QRIS di Admin**:
   - [src/app/admin/(dashboard)/orders/page.tsx](../../src/app/admin/(dashboard)/orders/page.tsx): Modal lihat bukti QRIS (`viewingProofIntent`), tombol *Konfirmasi Lunas* (`payment_status = 'paid'`), dan *Selesaikan & Hapus Bukti*.
   - [src/app/api/admin/intents/route.ts](../../src/app/api/admin/intents/route.ts): Saat status berubah menjadi `paid` atau `completed`, memicu RPC `deduct_product_stock` secara atomik dan mencatat audit trail ke `order_status_log`.
   - [src/app/api/admin/intents/delete-proof/route.ts](../../src/app/api/admin/intents/delete-proof/route.ts): Menghapus file fisik dari bucket `payment-proofs` dan menghapus baris di tabel `payment_proofs` untuk menghemat kuota storage.

## 2. Standar UX & Teknis Fitur QRIS E-Commerce Indonesia

Saat membenahi atau mengembangkan fitur QRIS di Al Parfume, pastikan standar berikut terpenuhi:
1. **Kemudahan Pembayaran di HP (Mobile-First QRIS UX)**:
   - Mayoritas pelanggan membuka website dari HP, sehingga mereka **tidak bisa men-scan layar HP mereka sendiri**.
   - **WAJIB** sediakan tombol **"Unduh / Simpan Gambar QRIS"** (`<a href="/qris.jpg" download="QRIS-AlParfume.jpg">` atau hasil render canvas) agar pelanggan bisa langsung mengunggah gambar QRIS dari galeri ke aplikasi M-Banking / GoPay / ShopeePay / DANA.
   - **WAJIB** tampilkan nominal **Total Pembayaran (`grandTotal`)** dengan jelas tepat di atas/bawah gambar QRIS disertai tombol **"Salin Nominal"** (menyalin angka murni tanpa titik/Rp, misal `59000`, agar mudah di-*paste* di aplikasi bank).
2. **Alur Upload & Ganti Bukti Pembayaran (Re-upload Support)**:
   - Selama `payment_status !== "paid"` dan `fulfillment_status !== "completed"`, pelanggan **harus bisa mengganti / mengunggah ulang** foto bukti transfer jika salah pilih foto.
   - Di [src/components/OrderStatusClient.tsx](../../src/components/OrderStatusClient.tsx), meskipun `proofUrl` sudah ada, sediakan tombol *"Ganti Foto Bukti"* selama pesanan belum diverifikasi lunas (`!isPaid && !isCompleted`).
3. **QRIS Dinamis (Opsional / Pengembangan Lanjutan)**:
   - Jika mengimplementasikan QRIS Dinamis dari string EMVCo statis toko, pastikan tag `54` (Transaction Amount) diisi nilai `grandTotal` bulat tanpa desimal, ubah tag `01` dari `11` (statis) ke `12` (dinamis), dan hitung ulang tag `63` (CRC16-CCITT `0xFFFF`, polinomial `0x1021`). Jangan pernah mengubah tag merchant ID (`26`-`51`).
4. **Efisiensi Polling & Realtime**:
   - Jangan melakukan polling agresif jika tab browser sedang tersembunyi (`document.visibilityState === "hidden"`) atau jika pesanan sudah berstatus `completed`.

## 3. Langkah Verifikasi Setelah Mengubah Kode QRIS

1. Jalankan `npx tsc --noEmit` untuk memastikan tidak ada error TypeScript.
2. Pastikan endpoint `/api/orders/upload-proof` tetap menolak ID angka murni (proteksi IDOR) dan hanya menerima `order_code` (`ORD-...`).
3. Pastikan data pesanan yang sudah ada di tabel `orders` maupun `order_intents` tetap menampilkan bukti transfer dengan benar.
