"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, ProductWithVariants } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import DashboardCharts from "@/components/DashboardCharts";
import { 
  Loader2, Plus, Image as ImageIcon, ShoppingBag, 
  AlertTriangle, ArrowRight, CheckCircle2, Clock, 
  Flame, Sparkles, Trophy
} from "lucide-react";
import Link from "next/link";

interface TopProductStat {
  productName: string;
  totalQty: number;
  totalRevenue: number;
  percentage: number;
}

export default function DashboardOverview() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [statsData, setStatsData] = useState<{ date: string; sales: number; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductStat[]>([]);
  const [loading, setLoading] = useState(true);

  const [completedRevenue, setCompletedRevenue] = useState(0);
  const [inProgressRevenue, setInProgressRevenue] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [productsRes, statsRes] = await Promise.all([
        supabase
          .from("products")
          .select("*, product_variants(*)")
          .order("created_at", { ascending: false }),
        fetch(`/api/admin/stats?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token || ""}` },
          cache: "no-store",
        }),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        
        if (statsJson.summary) {
          setCompletedRevenue(statsJson.summary.completedRevenue || 0);
          setInProgressRevenue(statsJson.summary.inProgressRevenue || 0);
          setCompletedOrdersCount(statsJson.summary.completedOrdersCount || 0);
          setPendingOrdersCount(statsJson.summary.pendingOrdersCount || 0);
        }

        if (Array.isArray(statsJson.dailyStats)) {
          setStatsData(statsJson.dailyStats);
        } else if (Array.isArray(statsJson)) {
          setStatsData(statsJson);
        }

        if (Array.isArray(statsJson.topProducts)) {
          setTopProducts(statsJson.topProducts);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard overview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const activeProductsCount = products.filter((p) => p.is_active).length;
  const lowStockProducts = products.filter((p) => p.is_active && (p.stock ?? 10) <= 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white shadow-xs">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Quick Shortcuts */}
      <div className="bg-gradient-to-r from-neutral-900 via-black to-neutral-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Overview Toko
          </span>
          <h1 className="text-xl sm:text-2xl font-bold font-plus-jakarta tracking-tight text-white">
            Selamat Datang di Admin AL Parfume
          </h1>
          <p className="text-xs text-neutral-300 leading-relaxed font-light">
            Pantau ringkasan omset pesanan, mutasi stok parfum, dan tren produk terlaris secara real-time dari satu tempat.
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
          <span className="text-[10px] text-neutral-400 font-medium">Sedang dipacking & dikirim</span>
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
          <span className="text-[10px] text-neutral-400 font-medium">Tampil aktif di halaman toko</span>
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

      {/* Section 2: Grafik Penjualan & Peringkat Produk Terlaris */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Penjualan (Span 2 Cols on Large Screen) */}
        <div className="lg:col-span-2 border border-neutral-200/80 bg-white rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-bold text-base font-plus-jakarta text-neutral-900">Grafik Performa Penjualan</h3>
            <p className="text-xs text-neutral-400">Tren transaksi dan nominal omset dalam 30 hari terakhir</p>
          </div>
          <DashboardCharts data={statsData} />
        </div>

        {/* Peringkat Produk Terlaris (Top Best-Selling Perfumes) */}
        <div className="border border-neutral-200/80 bg-white rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-base font-plus-jakarta text-neutral-900">Produk Terlaris</h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">Varian parfum paling diminati pelanggan</p>
              </div>
              <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Top 5
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 space-y-2">
                <Flame className="w-8 h-8 mx-auto text-neutral-300 stroke-1" />
                <p className="text-xs font-medium">Belum ada data penjualan produk</p>
                <p className="text-[10px] text-neutral-400">Data terlaris akan otomatis muncul saat ada pesanan selesai</p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {topProducts.map((item, idx) => {
                  const rankColors = [
                    "bg-amber-400/20 text-amber-800 border-amber-400/30",
                    "bg-neutral-200 text-neutral-800 border-neutral-300",
                    "bg-amber-700/10 text-amber-900 border-amber-700/20",
                    "bg-neutral-100 text-neutral-600 border-neutral-200",
                    "bg-neutral-100 text-neutral-600 border-neutral-200",
                  ];
                  const rankBadge = rankColors[idx] || "bg-neutral-100 text-neutral-600 border-neutral-200";

                  return (
                    <div key={idx} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border shrink-0 ${rankBadge}`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-neutral-800 truncate font-plus-jakarta text-xs">
                            {item.productName}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-neutral-900 text-xs block">{item.totalQty} botol</span>
                          <span className="text-[10px] text-emerald-600 font-medium">{formatRupiah(item.totalRevenue)}</span>
                        </div>
                      </div>

                      {/* Clean Progress Bar */}
                      <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-neutral-900 h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(item.percentage, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-neutral-100 mt-5">
            <Link
              href="/admin/products"
              className="text-xs text-neutral-500 hover:text-black font-semibold inline-flex items-center justify-center w-full gap-1.5 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              Lihat Seluruh Stok Katalog <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}