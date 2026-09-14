# AGENT.MD — PANDUAN PENGEMBANGAN & PERSONA SENIOR DEVELOPER (AL PARFUME)

Dokumen ini adalah panduan standar dan instruksi teknis bagi AI Agent maupun pengembang yang bekerja pada repositori **Al Parfume**. Setiap tindakan pengembangan wajib mengikuti standar kualitas dan mindset seorang **Senior Fullstack Developer / Technical Lead**.

---

## 1. Persona & Prinsip Senior Developer

Sebagai Senior Developer di proyek ini, Anda wajib memegang prinsip-prinsip berikut:
1. **Zero-Trust Client Mindset**: Jangan pernah mempercayai payload dari sisi klien (harga per item, ongkir, kuantitas, atau status pembayaran). Seluruh perhitungan kritis (subtotal, total ongkir, grand total, status awal) wajib divalidasi dan dihitung ulang di server (`src/app/api/...`).
2. **Defensive Programming & Resilient Fallbacks**: API pihak ketiga (RajaOngkir, EMSIFA, Supabase) dapat mengalami downtime, kuota habis, atau latency tinggi. Seluruh integrasi eksternal wajib memiliki penanganan batas waktu (*timeout* dengan `AbortSignal.timeout`) dan jalur *fallback* otomatis yang menjaga pengalaman checkout pelanggan tetap mulus tanpa pesan error 500.
3. **Integritas Data & Mutasi Atomik**: Setiap transaksi yang mempengaruhi persediaan barang wajib menggunakan mekanisme atomik database (seperti stored procedure `deduct_product_stock` dan log audit `stock_movements`). Hindari *race conditions*.
4. **Security & Privacy by Default**: 
   - Lindungi data sensitif pelanggan (nomor WhatsApp, detail alamat) dengan Row Level Security (RLS) di PostgreSQL.
   - Masking informasi pribadi pada endpoint publik (`orders/status`).
   - Jangan pernah membocorkan `SUPABASE_SERVICE_ROLE_KEY` ke sisi browser atau environment variable `NEXT_PUBLIC_*`.
5. **Clean Code & Strict Typing**: Hindari *quick-and-dirty fixes*. Gunakan TypeScript yang ketat tanpa mengandalkan `any`, pisahkan logic ke dalam helper fungsi yang reusable, dan sediakan error handling yang deskriptif.

---

## 2. Gambaran Proyek & Tech Stack

**Al Parfume** adalah platform e-commerce parfum D2C (Direct-to-Consumer) modern:
- **Framework**: Next.js 15 (App Router, Server Components + Client Components)
- **UI & Styling**: React 19, Tailwind CSS v3, Lucide React Icons
- **Database & Storage**: Supabase (PostgreSQL dengan RLS, Storage Bucket untuk bukti pembayaran, Stored Functions untuk stok)
- **Shipping Provider**:
  - Primary Live API: RajaOngkir Komerce V2 API (`https://rajaongkir.komerce.id/api/v1`)
  - Regional Dataset: EMSIFA Wilayah Indonesia API (`https://www.emsifa.com/api-wilayah-indonesia/`)
  - Internal Engine: Multi-Tier Realistic Regional Tariff Fallback

---

## 3. Struktur Direktori & Tanggung Jawab Modul

```text
alparfume/
├── src/
│   ├── app/
│   │   ├── admin/                    # Portal manajemen admin (dashboard, produk, order, kategori)
│   │   ├── api/
│   │   │   ├── admin/                # Endpoint admin (stats, intents, revalidate, delete-proof)
│   │   │   ├── orders/
│   │   │   │   ├── create/route.ts   # Pembuatan pesanan (Server-side price/ongkir verification)
│   │   │   │   ├── status/route.ts   # Public tracking order (masked data + rate limited)
│   │   │   │   └── upload-proof/     # Upload bukti bayar QRIS ke Supabase Storage
│   │   │   └── shipping/
│   │   │       ├── cost/route.ts     # Engine kalkulasi ongkos kirim (Dual-engine: Live + Fallback)
│   │   │       └── regions/route.ts  # Cascading lookup: Provinsi -> Kota/Kabupaten -> Kecamatan
│   │   ├── checkout/                 # Halaman checkout belanja
│   │   ├── orders/[id]/              # Halaman detail status pesanan & instruksi pembayaran
│   │   ├── products/[slug]/          # Halaman detail produk & varian ukuran (18ml, 20ml, 30ml)
│   │   ├── layout.tsx                # Root layout, font konfigurasi, theme provider
│   │   └── page.tsx                  # Landing page (Hero Slider, Grid Kategori, Produk Unggulan)
│   ├── components/                   # Komponen antarmuka pengguna (UI Components)
│   │   ├── CheckoutClient.tsx        # Form checkout, pemilihan wilayah, kalkulasi ongkir & metode pengiriman
│   │   ├── CartDrawer.tsx            # Slide-over keranjang belanja
│   │   ├── ProductCard.tsx           # Kartu katalog produk
│   │   └── ...
│   ├── context/
│   │   ├── CartContext.tsx           # State keranjang belanja pelanggan (tersimpan di localStorage)
│   │   └── ThemeContext.tsx          # Pengatur tema tampilan
│   └── lib/
│       ├── adminAuth.ts              # Verifikasi auth token JWT admin & helper getServiceClient()
│       ├── rateLimit.ts              # In-memory sliding rate limiter untuk proteksi DoS
│       ├── supabase.ts               # Client Supabase publik & TypeScript data interfaces
│       └── whatsapp.ts               # Generator tautan WhatsApp otomatis
├── supabase/
│   └── migrations/                   # Skrip migrasi PostgreSQL (tabel, RLS, function, index)
├── .env.local                        # Kunci rahasia API & URL konfigurasi lokal
└── package.json
```

---

## 4. Aturan Arsitektur & Standar Koding

### 4.1 Server Components vs. Client Components
- Seluruh halaman di `src/app/` dianjurkan menjadi **Server Component** untuk efisiensi render dan SEO, kecuali memerlukan state interaktif.
- Gunakan direktif `"use client"` hanya pada komponen yang memanfaatkan hooks browser (`useState`, `useEffect`, `useContext`, `useRouter`, dsb.).
- Data fetching server-side dapat memanfaatkan Next.js `fetch` dengan strategi caching dan revalidasi terencana (`next: { revalidate: 86400 }` untuk data statis seperti wilayah).

### 4.2 Database & Row Level Security (RLS)
- **Tabel Publik** (`products`, `product_variants`, `categories`):
  - RLS mengizinkan `SELECT` untuk peran publik/anonim.
  - Modifikasi data (`INSERT`, `UPDATE`, `DELETE`) hanya diizinkan via API routes yang terverifikasi session admin.
- **Tabel Transaksi & Data Pengguna** (`customers`, `orders`, `order_items`, `payment_proofs`, `stock_movements`, `order_status_log`):
  - **RLS ditutup penuh** bagi anonim.
  - Akses baca dan tulis HANYA dilakukan melalui Server-Side API menggunakan `getServiceClient()` (Supabase Service Role Key).
  - Jangan pernah menggunakan client anonim di sisi frontend untuk langsung meng-insert atau membaca tabel `orders`.

### 4.3 Rate Limiting & Proteksi Endpoint
Setiap endpoint API publik wajib memanggil helper `checkRateLimit`:
- `POST /api/orders/create`: Batas ketat (maksimal 15 req/menit per IP).
- `GET /api/orders/status`: Batas global 200 req/menit + Batas komposit 60 req/menit per order_code.
- `POST /api/shipping/cost`: Batas 45 req/menit per IP untuk mencegah eksploitasi kuota API Komerce.

---

## 5. Dokumentasi Modul Ongkir (Shipping System)

Sistem pengiriman pada proyek ini terdiri dari dua jalur utama:
1. **Kurir Ekspedisi (JNT, JNE, SiCepat, POS, dsb)**: Menggunakan kalkulasi dinamis berdasarkan berat item dan wilayah tujuan.
2. **Ambil di Toko / Store Pickup (Madiun)**: Bebas Ongkir (Rp0) dengan sistem bayar di toko (COD Pickup).

### 5.1 Alur Kerja Pencarian Wilayah (`/api/shipping/regions`)
Endpoint ini menerima query `type=provinces`, `type=cities`, atau `type=subdistricts` dengan mekanisme 3-tier:
1. **Level 1**: RajaOngkir Starter API (jika `RAJAONGKIR_API_KEY` aktif, timeout 2.5s).
2. **Level 2**: EMSIFA API Wilayah Indonesia (fallback dinamis dan otomatis jika RajaOngkir lambat/gagal).
3. **Level 3**: Dataset offline statis untuk 38 provinsi dan kota-kota utama Indonesia.

### 5.2 Alur Kerja Kalkulasi Tarif (`/api/shipping/cost`)
Endpoint ini menerima payload JSON:
```json
{
  "province": "Jawa Timur",
  "city": "Kota Surabaya",
  "cityId": "3578",
  "district": "Genteng",
  "weight": 700
}
```
Mekanisme perhitungan:
1. **Pencarian Destination ID**: Query alamat dicocokkan ke endpoint Komerce domestic destination.
2. **Live Rate Calculation**: Memanggil Komerce API untuk ekspedisi (`jne`, `jnt`, `sicepat`, `pos`, `anteraja`, `ninja`, dsb.) dari Origin Taman, Kota Madiun (`DEFAULT_ORIGIN_ID = 39901`).
3. **Realistic Internal Engine Fallback**: Jika API key tidak ada, habis kuota, atau request timeout, sistem otomatis beralih ke tarif zonasi fallback:
   - **Ring 1**: Karesidenan Madiun (Kota/Kab Madiun, Magetan, Ponorogo, Ngawi) (Tarif terendah: J&T Rp9.000, JNE Rp8.000, dst).
   - **Tier 7**: Jawa Timur luar Karesidenan Madiun (Rp11.000).
   - **Tier 5**: Jawa Tengah & DI Yogyakarta (Rp15.000).
   - **Tier 6**: Jabodetabek, Jawa Barat, & Banten (Rp18.000).
   - **Tier 2**: Bali, Nusa Tenggara, Sulawesi (Rp35.000).
   - **Tier 3**: Kalimantan (Rp42.000).
   - **Tier 4**: Sumatera & Kepulauan Riau / Babel (Rp45.000).
   - **Tier 1**: Papua & Maluku (Rp120.000).
   - **Default**: Wilayah lainnya (Rp22.000).
   *Seluruh tarif dasar di atas dikalikan dengan `weightKg` (`Math.ceil(weight / 1000)`).*

### 5.3 Kalkulasi Berat di Frontend (`CheckoutClient.tsx`)
- Setiap produk dihitung berbobot **1 kg (1000 gram)** per item sesuai kebijakan flat rate packaging toko.
- Rumus: `totalWeightGrams = Math.max(1000, totalQuantity * 1000)`.
- Ketika user memilih alamat atau mengubah kuantitas barang, frontend memicu debounce fetch 300ms ke `/api/shipping/cost` dan memperbarui daftar `courierOptions`.

### 5.4 Proteksi Server-Side (`/api/orders/create`)
- Nilai `shipping_cost` yang dikirim dari klien divalidasi ulang di backend.
- Jika metode pengiriman adalah `pickup`, ongkir dipaksa menjadi `0`.
- Jika `courier`, diverifikasi agar berupa angka non-negatif yang wajar.

---

## 6. Protokol Perubahan Kode bagi AI Agent

Sebelum melakukan perubahan kode pada repositori ini:
1. **Pahami Dampak Hulu ke Hilir**: Perubahan pada komponen formulir (seperti CheckoutClient) harus tetap selaras dengan schema API dan database Supabase.
2. **Jaga Konsistensi Format Data**:
   - Selalu bersihkan (sanitize) input pengguna dari karakter berbahaya sebelum disimpan ke database.
   - Format mata uang selalu gunakan Rupiah tanpa desimal (`Intl.NumberFormat('id-ID', ...)`).
3. **Uji Validasi Pasca Perubahan**:
   - Pastikan TypeScript tidak mendeteksi type error.
   - Pastikan alur fallback tetap berfungsi saat API pihak ketiga dinonaktifkan (`force_fallback: true` untuk pengujian).
