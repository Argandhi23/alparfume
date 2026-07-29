"use client";

import { useState, useEffect } from "react";
import { supabase, ProductWithVariants } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import DashboardCharts from "@/components/DashboardCharts";
import { Loader2 } from "lucide-react";

export default function DashboardOverview() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [statsData, setStatsData] = useState<{ date: string; sales: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [productsRes, statsRes] = await Promise.all([
        supabase.from("products").select("*, product_variants(*)"),
        fetch("/api/admin/stats", {
          headers: {
            Authorization: `Bearer ${token || ""}`,
          },
        }),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setStatsData(stats || []);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard overview:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = statsData.reduce((sum, item) => sum + item.revenue, 0);
  const totalSalesCount = statsData.reduce((sum, item) => sum + item.sales, 0);
  const activeProductsCount = products.filter((p) => p.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ringkasan Bisnis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6 font-sans">
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Total Volume Penjualan</span>
          <span className="text-2xl font-bold font-plus-jakarta text-neutral-900 mt-2">{totalSalesCount} Pesanan</span>
        </div>
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Total Pendapatan</span>
          <span className="text-2xl font-bold font-plus-jakarta text-emerald-600 mt-2">{formatRupiah(totalRevenue)}</span>
        </div>
        <div className="border border-neutral-200/80 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Produk Aktif</span>
          <span className="text-2xl font-bold font-plus-jakarta text-neutral-900 mt-2">{activeProductsCount} Produk</span>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts data={statsData} />
    </div>
  );
}