<div align="center">
  <img src="public/logo.png" alt="AL PARFUME Logo" width="96" height="96" />

  # AL PARFUME
  **Koleksi Parfum Mewah Minimalis — Direct-to-Consumer (D2C) E-Commerce Platform**

  [![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.2-149eca?style=flat-square&logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Storage-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)

  [**Kunjungi Website (alparfume.store)**](https://alparfume.store)
</div>

---

## Tentang Proyek

**AL PARFUME** adalah platform web *e-commerce* Direct-to-Consumer (D2C) resmi untuk brand parfum **AL PARFUME** (Kota Madiun, Jawa Timur). Aplikasi ini dirancang dengan estetika minimalis mewah (*luxury minimalist*), performa tinggi berbasis **Next.js 15 App Router**, serta alur belanja *mobile-first* yang memudahkan pelanggan memesan varian parfum secara langsung tanpa hambatan.

Platform ini mencakup keseluruhan ekosistem bisnis D2C: katalog interaktif multi-varian, mesin kalkulasi ongkos kirim otomatis ke 38 provinsi Indonesia, generator **QRIS Dinamis (EMVCo)**, pelacakan status pesanan *real-time*, hingga **Portal Admin** lengkap untuk pengelolaan inventaris dan verifikasi transaksi.

---

## Fitur Utama

### 1. Storefront & Katalog Pengalaman Belanja
- **Katalog Parfum Interaktif**: Pencarian instan, filter kategori, label *Best Seller*, serta informasi detail *Fragrance Notes* (*Top, Middle, Base Notes*).
- **Pilihan Multi-Varian Ukuran**: Dukungan harga dan pelacakan stok independen untuk berbagai ukuran botol (`10ml`, `18ml`, `20ml`, `30ml`).
- **Keranjang Belanja & Direct Buy**: Pelanggan dapat mengumpulkan banyak produk ke keranjang (`CartContext` tersinkronisasi dengan harga *live* database) atau langsung menuju *checkout* (*Beli Sekarang*).
- **Desain Adaptif (Light / Dark Mode)**: Antarmuka responsif dengan dukungan tema terang dan gelap yang halus.

### 2. Mesin Checkout & Pengiriman 3-Tier (Anti-Downtime)
- **Metode Pengiriman Fleksibel**:
  - **Ekspedisi Kurir**: Pengiriman ke seluruh kecamatan di Indonesia (JNE, J&T, SiCepat, POS, dll.) dari titik asal Kota Madiun.
  - **Ambil di Toko (*Store Pickup*)**: Opsi ambil langsung di toko offline AL PARFUME Madiun dengan bebas biaya ongkos kirim (`Rp 0`) dan dukungan bayar di tempat (*COD Pickup*) maupun QRIS.
- **Pencarian Wilayah & Kalkulasi Ongkir Berlapis**:
  - Menggunakan **RajaOngkir (Komerce API V2)** dengan *In-Memory Cache 12 Jam* dan *Quota Circuit Breaker*.
  - Dilengkapi **Fallback Otomatis** ke API Wilayah EMSIFA dan dataset tarif zonasi internal 38 provinsi sehingga proses *checkout* pelanggan tidak pernah gagal meskipun API pihak ketiga sedang mengalami gangguan.
- **Zero-Trust Server Validation**: Seluruh kalkulasi harga produk, ketersediaan stok, dan batas wajar ongkos kirim diverifikasi ulang di sisi server (`/api/orders/create`).

### 3. Sistem Pembayaran QRIS Dinamis & Pelacakan Pesanan
- **Engine QRIS Dinamis (EMVCo TLV + CRC16-CCITT)**:
  - Secara otomatis menyuntikkan nominal tagihan (`grandTotal`) ke dalam *payload* QRIS resmi **ALPARFUME.CO** dan menghitung ulang *checksum* CRC16-CCITT.
  - Merender gambar poster QRIS Dinamis yang dapat langsung diunduh pelanggan dari perangkat seluler, dilengkapi tombol salin nominal sekali klik.
- **Unggah Bukti Pembayaran Teroptimasi**:
  - Kompresi foto bukti transfer di sisi klien menggunakan `<canvas>` sebelum diunggah ke **Supabase Storage** (`payment-proofs`) dengan *rate-limiting* dan validasi tipe MIME.
  - Mendukung unggah ulang (*re-upload*) bukti pembayaran selama pesanan belum diverifikasi lunas.
- **Proteksi Privasi Pelanggan (PII Masking)**:
  - Halaman publik status pesanan (`/orders/[id]`) secara otomatis menyensor nomor WhatsApp dan detail alamat pelanggan untuk mencegah kebocoran data pribadi.

### 4. Portal Admin & Operasional Bisnis (`/admin`)
- **Dashboard & Analitik**: Visualisasi metrik pendapatan, total pesanan lunas, rata-rata nilai transaksi (*AOV*), dan grafik tren penjualan.
- **Manajemen Pesanan & Verifikasi Pembayaran**:
  - Filter pesanan berdasarkan status pembayaran, status pengiriman, metode kurir/ambil di toko, dan rentang tanggal.
  - Pratinjau bukti transfer QRIS, konfirmasi pembayaran lunas satu klik, input nomor resi pengiriman, dan tombol kirim notifikasi WhatsApp otomatis ke pelanggan.
  - Ekspor laporan transaksi lengkap ke format **Microsoft Excel (`.xls`)**.
  - Fitur pembersihan file bukti transfer dari *cloud storage* setelah pesanan selesai untuk menghemat kuota penyimpanan.
- **Manajemen Produk, Varian & Kategori**:
  - CRUD produk parfum beserta varian ukuran, harga, dan stok.
  - Pemotong gambar (*Image Cropper*) terintegrasi untuk mengunggah foto produk ke Supabase Storage.
  - **On-Demand ISR Revalidation** otomatis agar setiap perubahan produk/stok langsung tampil di katalog publik.
- **Manajemen Stok Atomik & Audit Trail**:
  - Pemotongan dan pengembalian stok dijalankan secara atomik di tingkat database menggunakan PostgreSQL Stored Procedures (`deduct_product_stock` & `restore_product_stock`) yang tercatat di tabel `stock_movements` dan `order_status_log`.

---

## Teknologi yang Digunakan

| Kategori | Teknologi |
| :--- | :--- |
| **Framework & UI** | [Next.js 15 (App Router)](https://nextjs.org/), [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling & Ikon** | [Tailwind CSS v3](https://tailwindcss.com/), CSS Variables, [Lucide React](https://lucide.dev/), Font *Plus Jakarta Sans* & *Geist Mono* |
| **Database & Backend** | [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, RPC Functions, Supabase Auth, Supabase Storage) |
| **Sistem Pembayaran** | Custom EMVCo Dynamic QRIS Generator + [`qrcode`](https://www.npmjs.com/package/qrcode) |
| **API Eksternal** | RajaOngkir (Komerce API V2) & EMSIFA Wilayah Indonesia API |

---

## Struktur Direktori

```text
alparfume/
├── public/                     # Aset statis (logo, template QRIS, gambar produk lokal)
├── src/
│   ├── app/
│   │   ├── admin/              # Portal Admin (Dashboard, Orders, Products, Categories, Settings)
│   │   ├── api/
│   │   │   ├── admin/          # Endpoint API Admin (terproteksi JWT Bearer Auth)
│   │   │   ├── analytics/      # Endpoint pencatatan kunjungan halaman
│   │   │   ├── orders/         # Pembuatan pesanan, cek status, & upload bukti bayar
│   │   │   └── shipping/       # Pencarian wilayah & kalkulasi ongkos kirim
│   │   ├── checkout/           # Halaman Checkout pelanggan
│   │   ├── orders/[id]/        # Halaman Invoice, QRIS Dinamis, & pelacakan pesanan
│   │   ├── products/[slug]/    # Halaman detail produk parfum (ISR)
│   │   └── page.tsx            # Halaman utama katalog AL PARFUME (ISR)
│   ├── components/             # Komponen UI (Navbar, CartDrawer, CheckoutClient, OrderStatusClient, dll.)
│   ├── context/                # React Context (CartContext & ThemeContext)
│   ├── lib/                    # Utilitas inti (Supabase client, Admin Auth, Engine QRIS, Tarif Ongkir)
│   └── types/                  # Definisi tipe TypeScript (Product, Variant, Order)
├── tailwind.config.ts          # Konfigurasi tema dan token warna Tailwind CSS
├── tsconfig.json               # Konfigurasi TypeScript
└── package.json                # Dependensi dan skrip proyek
```

---

## Menjalankan Proyek Secara Lokal

### 1. Prasyarat
- **Node.js** versi `20.x` atau lebih baru.
- Proyek **Supabase** yang aktif (Database PostgreSQL, Auth, dan Storage bucket `payment-proofs`).

### 2. Instalasi Dependensi
Clone repositori ini dan instal seluruh paket menggunakan `npm`:

```bash
git clone https://github.com/Argandhi23/alparfume.git
cd alparfume
npm install
```

### 3. Konfigurasi Variabel Lingkungan (`.env.local`)
Buat file `.env.local` di direktori utama proyek dan isi variabel berikut sesuai kredensial proyek Anda:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Shipping API Configuration (Opsional - Memiliki Fallback Internal)
RAJAONGKIR_API_KEY=your-komerce-rajaongkir-api-key
```

> **Catatan Keamanan:** Jangan pernah membagikan atau melakukan *commit* file `.env.local` ke repositori publik. `SUPABASE_SERVICE_ROLE_KEY` dan `RAJAONGKIR_API_KEY` hanya diakses di sisi server (*Route Handlers*).

### 4. Menjalankan Server Development
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser untuk melihat halaman toko, atau [http://localhost:3000/admin](http://localhost:3000/admin) untuk mengakses Portal Admin.

### 5. Build untuk Produksi
```bash
npx tsc --noEmit
npm run build
npm run start
```

---

## Arsitektur Keamanan

1. **Row Level Security (RLS) Ketat**:
   - Tabel katalog (`categories`, `products`, `product_variants`) hanya mengizinkan akses baca (`SELECT`) untuk publik.
   - Tabel sensitif (`customers`, `orders`, `order_items`, `payment_proofs`, `order_status_log`, `stock_movements`) dikunci penuh dari akses klien anonim dan hanya dapat diakses melalui *Server Route Handlers* menggunakan *Service Role* yang tervalidasi.
2. **Proteksi Endpoint Admin**:
   - Seluruh endpoint di bawah `/api/admin/*` memverifikasi sesi JWT Bearer Token Supabase Auth (`verifyAdminSession`).
3. **Anti-IDOR & PII Masking**:
   - Pelacakan dan pengunggahan bukti pembayaran wajib menggunakan kode pesanan unik (`ORD-...`), menolak enumerasi ID sekuensial, serta menyamarkan informasi pribadi pelanggan pada respons publik.

---

<div align="center">
  <sub>Hak Cipta &copy; 2026 <strong>AL PARFUME</strong> — Kota Madiun, Jawa Timur. Seluruh hak cipta dilindungi.</sub>
</div>
