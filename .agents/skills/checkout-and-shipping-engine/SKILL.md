---
name: checkout-and-shipping-engine
description: >-
  Use this skill when modifying the checkout flow (CheckoutClient.tsx),
  order creation (/api/orders/create), shipping cost calculation (/api/shipping/cost),
  regional lookup (/api/shipping/regions), store pickup logic, or cart state.
---

# Checkout & Shipping Engine Skill

Skill ini memandu perubahan pada alur keranjang belanja, checkout, kalkulasi ongkir, dan pembuatan pesanan di **Al Parfume**.

## 1. Peta File Utama

- [src/lib/shippingTariff.ts](../../src/lib/shippingTariff.ts): *Single Source of Truth* untuk tarif fallback 38 provinsi (`calculateFallbackShippingRates`), validasi batas bawah ongkir server (`validateServerCourierCost`), dan informasi lokasi toko Madiun (`STORE_PICKUP_INFO`).
- [src/components/CheckoutClient.tsx](../../src/components/CheckoutClient.tsx): Form informasi pemesan, sinkronisasi harga live dari DB, pemilihan metode pengiriman (`courier` vs `pickup`), dropdown berjenjang (Provinsi -> Kota/Kab -> Kecamatan), pemilihan ekspedisi, dan metode pembayaran (`qris` vs `cod_pickup`).
- [src/app/api/orders/create/route.ts](../../src/app/api/orders/create/route.ts): Pembuatan pesanan baru di server, validasi harga & ketersediaan stok varian dari DB, proteksi batas bawah ongkir per wilayah, serta pencatatan `customers`, `orders`, dan `order_items`.
- [src/app/api/shipping/regions/route.ts](../../src/app/api/shipping/regions/route.ts): Pencarian wilayah 3-tier (RajaOngkir -> EMSIFA API -> Static Dataset).
- [src/app/api/shipping/cost/route.ts](../../src/app/api/shipping/cost/route.ts): Perhitungan tarif kurir dari **Origin Kec. Taman, Kota Madiun (`39901`)** via Komerce API V2 dilengkapi **In-Memory Cache 12 Jam**, **Quota Circuit Breaker (HTTP 429/402/403)**, dan fallback tarif zonasi internal 38 provinsi.
- [src/context/CartContext.tsx](../../src/context/CartContext.tsx): State keranjang belanja di `localStorage`.

## 2. Aturan Kritis Checkout & Ongkir

1. **Aturan Berat Produk**:
   - Kebijakan toko menggunakan *flat packaging weight*: `totalWeightGrams = Math.max(1000, totalQuantity * 1000)` (1 item = 1 kg).
2. **Validasi Server-Side (`/api/orders/create`)**:
   - Harga satuan produk **wajib** diambil dari tabel `product_variants` di database berdasarkan `slug`/`id` dan `size_ml`, bukan dari payload client.
   - Untuk `delivery_method === "pickup"`, `shipping_cost` wajib dipaksa `0`.
   - Untuk `delivery_method === "courier"`, pastikan `shipping_cost` divalidasi minimal sesuai batas tarif terendah (> Rp5.000) agar tidak bisa dimanipulasi menjadi Rp0 oleh request palsu.
3. **Jangan Mutasi Stok dari Browser (`CheckoutClient.tsx`)**:
   - Karena RLS tabel `products` dan `product_variants` mengunci akses tulis bagi anonim, jangan melakukan `supabase.from("products").update(...)` dari client component. Mutasi stok dikelola di sisi server melalui RPC atomik `deduct_product_stock`.
4. **Konsistensi Informasi Toko Madiun (Store Pickup)**:
   - Pastikan alamat dan jam operasional toko untuk opsi *Ambil di Toko* konsisten antara `CheckoutClient.tsx` dan `OrderStatusClient.tsx`.

## 3. Verifikasi Pasca-Perubahan

- Uji skenario *Direct Buy* (`/checkout?slug=...&size=...&qty=...`) maupun *Cart Checkout*.
- Pastikan fallback ongkir tetap berjalan mulus meskipun API eksternal sedang lambat/offline.
- Jalankan `npx tsc --noEmit`.
