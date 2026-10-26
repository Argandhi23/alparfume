"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { AnalyticsData, DailyTrendItem } from "@/lib/analyticsHelper";
import {
  TrendingUp,
  Calendar,
  Globe,
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  Compass,
  ArrowUpRight,
  Activity,
  Layers,
} from "lucide-react";
import Link from "next/link";

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d">("30d");
  const [activeHoverIdx, setActiveHoverIdx] = useState<number | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  const chartSvgRef = useRef<SVGSVGElement>(null);

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/analytics?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        if (json.analytics) {
          setData(json.analytics);
          const now = new Date();
          setLastRefreshedAt(
            now.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        }
      }
    } catch (err) {
      console.error("Gagal memuat analitik pengunjung:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Real-time 30s auto-refresh with tab visibility check
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAnalytics();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAnalytics();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAnalytics]);

  // Chart data calculation
  const rawChartData: DailyTrendItem[] = data?.dailyTrend || [];
  const chartData =
    selectedRange === "7d" ? rawChartData.slice(-7) : rawChartData;

  const maxVal = Math.max(
    ...chartData.flatMap((d) => [d.uniqueVisitors, d.pageViews]),
    10
  );

  const chartWidth = 700;
  const chartHeight = 220;
  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const pointsUnique = chartData.map((d, i) => {
    const x =
      padding.left +
      (chartData.length > 1 ? (i / (chartData.length - 1)) * innerWidth : innerWidth / 2);
    const y = padding.top + innerHeight - (d.uniqueVisitors / maxVal) * innerHeight;
    return { x, y, val: d.uniqueVisitors, item: d };
  });

  const pointsViews = chartData.map((d, i) => {
    const x =
      padding.left +
      (chartData.length > 1 ? (i / (chartData.length - 1)) * innerWidth : innerWidth / 2);
    const y = padding.top + innerHeight - (d.pageViews / maxVal) * innerHeight;
    return { x, y, val: d.pageViews, item: d };
  });

  const makeLinePath = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");

  const makeAreaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    const line = makeLinePath(pts);
    return `${line} L ${pts[pts.length - 1].x} ${chartHeight - padding.bottom} L ${pts[0].x} ${
      chartHeight - padding.bottom
    } Z`;
  };

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartSvgRef.current || chartData.length === 0) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    pointsUnique.forEach((p, idx) => {
      const diff = Math.abs(p.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setActiveHoverIdx(closestIdx);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28 border border-neutral-200/80 bg-white rounded-3xl shadow-xs space-y-4 font-sans">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Memuat Analitik Kunjungan...
        </p>
      </div>
    );
  }

  const today = data?.today || { uniqueVisitors: 0, pageViews: 0 };
  const last7Days = data?.last7Days || { uniqueVisitors: 0, pageViews: 0 };
  const last30Days = data?.last30Days || { uniqueVisitors: 0, pageViews: 0 };
  const allTime = data?.allTime || { uniqueVisitors: 0, pageViews: 0 };

  const hoveredItem =
    activeHoverIdx !== null && chartData[activeHoverIdx]
      ? chartData[activeHoverIdx]
      : null;

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-black text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Real-Time
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
              Auto-refresh 30s
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Analitik Kunjungan Website
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Data pelacakan pengunjung unik dan total tayangan halaman publik Al Parfume. Halaman admin dan bot otomatis disaring.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {lastRefreshedAt && (
            <div className="text-[11px] text-neutral-400 bg-neutral-900/80 px-3 py-2 rounded-xl border border-neutral-800 text-center font-mono">
              Update: {lastRefreshedAt} WIB
            </div>
          )}
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Memperbarui..." : "Refresh Sekarang"}</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Hari Ini */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
              Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">
                {today.uniqueVisitors.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-neutral-500 font-medium">Orang Unik</span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Total {today.pageViews.toLocaleString("id-ID")} klik halaman
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Sejak 00:00 WIB</span>
            <span className="font-semibold text-emerald-600">Aktif</span>
          </div>
        </div>

        {/* 2. 7 Hari Terakhir */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              7 Hari Terakhir
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">
                {last7Days.uniqueVisitors.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-neutral-500 font-medium">Orang Unik</span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Total {last7Days.pageViews.toLocaleString("id-ID")} klik halaman
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>1 Minggu Terakhir</span>
            <span className="font-semibold text-indigo-600">Mingguan</span>
          </div>
        </div>

        {/* 3. 1 Bulan Terakhir */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
              1 Bulan (30 Hari)
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">
                {last30Days.uniqueVisitors.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-neutral-500 font-medium">Orang Unik</span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Total {last30Days.pageViews.toLocaleString("id-ID")} klik halaman
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>30 Hari Terakhir</span>
            <span className="font-semibold text-amber-700">Bulanan</span>
          </div>
        </div>

        {/* 4. Total Seluruhnya */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-md">
              Seluruh Waktu
            </span>
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 group-hover:scale-110 transition-transform">
              <Globe className="w-4 h-4 text-neutral-900" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">
                {allTime.uniqueVisitors.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-neutral-500 font-medium">Orang Unik</span>
            </div>
            <p className="text-[11px] text-neutral-400 font-medium">
              Total {allTime.pageViews.toLocaleString("id-ID")} klik halaman
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Sepanjang Masa</span>
            <span className="font-semibold text-neutral-700">All-Time</span>
          </div>
        </div>
      </div>

      {/* Interactive Trend Chart */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neutral-800" />
              Grafik Tren Kunjungan Harian
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Perbandingan Pengunjung Unik vs Total Tayangan Halaman per hari.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 bg-neutral-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setSelectedRange("7d")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedRange === "7d"
                    ? "bg-white text-black shadow-xs font-bold"
                    : "text-neutral-500 hover:text-black"
                }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setSelectedRange("30d")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedRange === "30d"
                    ? "bg-white text-black shadow-xs font-bold"
                    : "text-neutral-500 hover:text-black"
                }`}
              >
                30 Hari
              </button>
            </div>
          </div>
        </div>

        {/* Legend & Hover Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-50/80 px-4 py-3 rounded-2xl border border-neutral-100">
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2 font-medium text-neutral-700">
              <span className="w-3 h-3 rounded-full bg-neutral-900 border-2 border-white shadow-xs" />
              <span>Pengunjung Unik</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-neutral-700">
              <span className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-xs" />
              <span>Total Pageviews</span>
            </div>
          </div>

          {hoveredItem ? (
            <div className="text-xs font-mono bg-white px-3 py-1.5 rounded-xl border border-neutral-200/80 shadow-xs flex items-center gap-3">
              <span className="font-bold text-neutral-900">{hoveredItem.label}:</span>
              <span className="text-neutral-900 font-semibold">
                👤 {hoveredItem.uniqueVisitors} unik
              </span>
              <span className="text-indigo-600 font-semibold">
                👁️ {hoveredItem.pageViews} tayang
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-neutral-400 italic">
              Arahkan kursor ke grafik untuk melihat detail harian
            </span>
          )}
        </div>

        {/* SVG Chart */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[600px]">
            <svg
              ref={chartSvgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setActiveHoverIdx(null)}
            >
              <defs>
                <linearGradient id="gradientUnique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#171717" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#171717" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gradientViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padding.top + innerHeight * (1 - ratio);
                const val = Math.round(maxVal * ratio);
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray={ratio === 0 ? "none" : "3 3"}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      className="font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area Paths */}
              <path
                d={makeAreaPath(pointsViews)}
                fill="url(#gradientViews)"
              />
              <path
                d={makeAreaPath(pointsUnique)}
                fill="url(#gradientUnique)"
              />

              {/* Line Paths */}
              <path
                d={makeLinePath(pointsViews)}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={makeLinePath(pointsUnique)}
                fill="none"
                stroke="#171717"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hover Crosshair */}
              {activeHoverIdx !== null && pointsUnique[activeHoverIdx] && (
                <g>
                  <line
                    x1={pointsUnique[activeHoverIdx].x}
                    y1={padding.top}
                    x2={pointsUnique[activeHoverIdx].x}
                    y2={chartHeight - padding.bottom}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Point circles */}
                  <circle
                    cx={pointsViews[activeHoverIdx].x}
                    cy={pointsViews[activeHoverIdx].y}
                    r="5"
                    fill="#6366f1"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle
                    cx={pointsUnique[activeHoverIdx].x}
                    cy={pointsUnique[activeHoverIdx].y}
                    r="5"
                    fill="#171717"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* X-Axis Labels */}
              {chartData.map((d, i) => {
                // Show label on step intervals so labels don't collide
                const step = selectedRange === "7d" ? 1 : 5;
                if (i % step !== 0 && i !== chartData.length - 1) return null;
                const p = pointsUnique[i];
                return (
                  <text
                    key={d.date}
                    x={p.x}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                    className="font-medium"
                  >
                    {d.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Grid: Top Pages & Device/Referrers Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Top Pages (2 cols span on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-neutral-800" />
                Halaman Terpopuler (Top Pages)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                10 halaman yang paling banyak diakses oleh pengunjung dalam 30 hari terakhir.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full">
              30 Hari
            </span>
          </div>

          {data?.topPages && data.topPages.length > 0 ? (
            <div className="space-y-3">
              {data.topPages.map((page, idx) => (
                <div
                  key={page.path}
                  className="p-3.5 rounded-2xl bg-neutral-50/70 border border-neutral-100 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <Link
                        href={page.path}
                        target="_blank"
                        className="font-mono font-semibold text-neutral-900 hover:underline truncate inline-flex items-center gap-1 group"
                      >
                        <span className="truncate">{page.path}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <span className="text-[11px] text-neutral-500">
                        <strong className="text-neutral-900">{page.uniqueVisitors}</strong> unik
                      </span>
                      <span className="font-bold text-neutral-900 text-xs w-16 text-right">
                        {page.views.toLocaleString("id-ID")} view
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-neutral-900 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(page.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              Belum ada data kunjungan halaman yang tercatat.
            </div>
          )}
        </div>

        {/* Right Column: Devices & Referrers */}
        <div className="space-y-8">
          {/* Device Distribution Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-neutral-800" />
                Tipe Perangkat
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Perangkat yang digunakan pengunjung.
              </p>
            </div>

            {data?.devices && data.devices.length > 0 ? (
              <div className="space-y-4">
                {data.devices.map((d) => {
                  const IconComponent = d.device.includes("Mobile")
                    ? Smartphone
                    : d.device.includes("Tablet")
                    ? Tablet
                    : Monitor;
                  return (
                    <div key={d.device} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-neutral-800">
                          <IconComponent className="w-3.5 h-3.5 text-neutral-500" />
                          {d.device}
                        </span>
                        <span className="font-bold text-neutral-900">
                          {d.percentage}% ({d.count})
                        </span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(d.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">Belum ada data perangkat.</p>
            )}
          </div>

          {/* Traffic Sources / Referrer Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                <Compass className="w-4 h-4 text-neutral-800" />
                Sumber Trafik (Referrer)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Asal muasal pengunjung menemukan Al Parfume.
              </p>
            </div>

            {data?.referrers && data.referrers.length > 0 ? (
              <div className="space-y-3">
                {data.referrers.map((ref) => (
                  <div
                    key={ref.source}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-50 border border-neutral-100"
                  >
                    <span className="font-semibold text-neutral-800">{ref.source}</span>
                    <span className="font-mono text-neutral-600 bg-white px-2 py-0.5 rounded-md border border-neutral-200/60 font-medium">
                      {ref.count} kunjungan
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">Belum ada data sumber trafik.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
