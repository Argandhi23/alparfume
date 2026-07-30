"use client";

import { useState, useEffect } from "react";
import { supabase, ProductWithVariants } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import DashboardCharts from "@/components/DashboardCharts";
import { Loader2, Plus, Image as ImageIcon, ShoppingBag, AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardOverview() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [statsData, setStatsData] = useState<{ date: string; sales: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [completedRevenue, setCompletedRevenue] = useState(0);
  const [inProgressRevenue, setInProgressRevenue] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [productsRes, statsRes, intentsRes] = await Promise.all([
        supabase.from("products").select("*, product_variants(*)"),
        fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token || ""}` },
        }),
        supabase.from("order_intents").select("price, total_price, payment_status, fulfillment_status, items_json").limit(200),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setStatsData(stats || []);
      }

      if (intentsRes.data) {
        let completedRev = 0;
        let inProgressRev = 0;
        let completedCount = 0;
        let pendingCount = 0;

        intentsRes.data.forEach((int) => {
          let meta: Record<string, unknown> = {};
          if (int.items_json) {
            try {
              const parsed = typeof int.items_json === "string" ? JSON.parse(int.items_json) : int.items_json;
              if (typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed as Record<string, unknown>;
            } catch {}
          }

          const priceNum = Number(int.total_price || int.price || meta.grandTotal || meta.total_price) || 0;
          const fulfillment = int.fulfillment_status || meta.fulfillment_status || meta.fulfillmentStatus || "pending";
          const payment = int.payment_status || meta.payment_status || meta.paymentStatus || "pending_verification";

          if (fulfillment === "completed" || fulfillment === "selesai") {
            completedRev += priceNum;
            completedCount += 1;
          } else {
            inProgressRev += priceNum;
            if (payment !== "paid") {
              pendingCount += 1;
            }
          }
        });

        setCompletedRevenue(completedRev);
        setInProgressRevenue(inProgressRev);
        setCompletedOrdersCount(completedCount);
        setPendingOrdersCount(pendingCount);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeProductsCount = products.filter((p) => p.is_active).length;
  const lowStockProducts = products.filter((p) => p.is_active && (p.stock ?? 10) <= 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Quick Shortcuts */}
      <div className="bg-gradient-to-r from-neutral-900 via-black to-neutral-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            Overview Toko
          </span>
          <h1 className="text-xl sm:text-2xl font-bold font-plus-jakarta tracking-tight text-white">
            Selamat Datang di Admin Al Parfume
          </h1>
          <p className="text-xs text-neutral-300 leading-relaxed font-light">
            Kelola katalog parfum, banner promo, dan pantau status transaksi pengiriman secara real-time dari satu tempat yang simpel.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Link
            href="/admin/products"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-100 font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4 text-black" />
            Tambah Produk
          </Link>
          <Link
            href="/admin/categories"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs border border-neutral-700 transition-all duration-200"
          >
            <ImageIcon className="w-4 h-4 text-amber-300" />
            Banner Promo
          </Link>
          <Link
            href="/admin/orders"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-4 py-2.5 rounded-2xl text-xs border border-neutral-700 transition-all duration-200"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            Daftar Pesanan
          </Link>
        </div>
      </div>

      {/* Ringkasan Bisnis Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pendapatan Pesanan Selesai */}
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-extrabold">Pendapatan Selesai</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-plus-jakarta text-emerald-600">{formatRupiah(completedRevenue)}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{completedOrdersCount} Pesanan Berhasil Selesai</span>
        </div>

        {/* Pendapatan Dalam Proses */}
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-extrabold">Omset Dalam Proses</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-plus-jakarta text-blue-600">{formatRupiah(inProgressRevenue)}</div>
          <span className="text-[10px] text-neutral-400 font-medium">Sedang dikemas & dikirim</span>
        </div>

        {/* Status Pesanan Menunggu */}
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-extrabold">Perlu Verifikasi</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-plus-jakarta text-amber-600">{pendingOrdersCount} Pesanan</div>
          <Link href="/admin/orders" className="text-[10px] text-neutral-500 hover:text-black font-semibold inline-flex items-center gap-1">
            Cek verifikasi bukti <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Produk Aktif */}
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-extrabold">Katalog Produk</span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700">
              <Plus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-plus-jakarta text-neutral-900">{activeProductsCount} Produk</div>
          <span className="text-[10px] text-neutral-400 font-medium">Tampil di halaman pembeli</span>
        </div>
      </div>

      {/* Peringatan Stok Terbatas (Low Stock Alert Widget) */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-900 font-plus-jakarta">
                Perhatian: {lowStockProducts.length} Produk Menjelang Habis (Stok ≤ 5)
              </h4>
              <p className="text-[11px] text-amber-800 font-light mt-0.5">
                {lowStockProducts.map((p) => p.name).slice(0, 3).join(", ")}
                {lowStockProducts.length > 3 ? ` dan ${lowStockProducts.length - 3} produk lainnya` : ""}
              </p>
            </div>
          </div>
          <Link
            href="/admin/products"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors shrink-0"
          >
            Update Stok Produk
          </Link>
        </div>
      )}

      {/* Grafik Penjualan */}
      <div className="border border-neutral-200/80 bg-white rounded-3xl p-6 shadow-xs">
        <div className="mb-4">
          <h3 className="font-bold text-base font-plus-jakarta text-neutral-900">Grafik Performa Penjualan</h3>
          <p className="text-xs text-neutral-400">Pantau perkembangan transaksi per hari</p>
        </div>
        <DashboardCharts data={statsData} />
      </div>
    </div>
  );
}