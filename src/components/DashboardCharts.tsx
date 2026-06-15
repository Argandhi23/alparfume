"use client";

import React, { useState, useRef } from "react";
import { formatRupiah } from "@/lib/whatsapp";

interface StatItem {
  date: string;
  sales: number;
  revenue: number;
}

interface DashboardChartsProps {
  data: StatItem[];
}

export default function DashboardCharts({ data }: DashboardChartsProps) {
  const [activeIdxSales, setActiveIdxSales] = useState<number | null>(null);
  const [activeIdxRev, setActiveIdxRev] = useState<number | null>(null);
  
  const salesRef = useRef<SVGSVGElement>(null);
  const revRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) {
    return (
      <div className="border border-neutral-100 bg-white rounded-2xl p-8 text-center text-neutral-400 text-xs font-sans">
        Belum ada data untuk menampilkan grafik.
      </div>
    );
  }

  // Sizing configuration
  const width = 500;
  const height = 220;
  const padding = { top: 20, right: 15, bottom: 35, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 1. Calculate for Sales
  const maxSales = Math.max(...data.map((d) => d.sales), 5); // Fallback to min height 5
  const salesPoints = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.sales / maxSales) * chartHeight;
    return { x, y, val: d.sales, date: d.date };
  });

  const salesLinePath = salesPoints.reduce(
    (path, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`),
    ""
  );

  const salesAreaPath =
    salesPoints.length > 0
      ? `${salesLinePath} L ${salesPoints[salesPoints.length - 1].x} ${height - padding.bottom} L ${
          salesPoints[0].x
        } ${height - padding.bottom} Z`
      : "";

  // 2. Calculate for Revenue
  const maxRev = Math.max(...data.map((d) => d.revenue), 100000); // Fallback to min height Rp100k
  const revPoints = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.revenue / maxRev) * chartHeight;
    return { x, y, val: d.revenue, date: d.date };
  });

  const revLinePath = revPoints.reduce(
    (path, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`),
    ""
  );

  const revAreaPath =
    revPoints.length > 0
      ? `${revLinePath} L ${revPoints[revPoints.length - 1].x} ${height - padding.bottom} L ${
          revPoints[0].x
        } ${height - padding.bottom} Z`
      : "";

  // Helper: Find closest point on mouse move
  const handleMouseMove = (
    e: React.MouseEvent<SVGSVGElement>,
    points: { x: number; y: number }[],
    setIdx: (idx: number | null) => void,
    svgRef: React.RefObject<SVGSVGElement>
  ) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    // Find the point closest to mouseX
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setIdx(closestIdx);
  };

  // Format short date for X-Axis (e.g. 15 Jun)
  const formatXLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  // Generate grid values for Y-Axis
  const getGridValues = (max: number) => {
    return [0, max * 0.25, max * 0.5, max * 0.75, max];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 font-sans">
      {/* 1. SALES CHART */}
      <div className="border border-neutral-100 bg-white rounded-2xl p-6 shadow-sm relative">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Tren Volume Penjualan</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">30 Hari Terakhir</p>
          </div>
          {activeIdxSales !== null && (
            <div className="text-right">
              <span className="text-xs font-bold text-neutral-900">{salesPoints[activeIdxSales].val} Pesanan</span>
              <p className="text-[10px] text-neutral-400">{formatXLabel(salesPoints[activeIdxSales].date)}</p>
            </div>
          )}
        </div>

        <div className="relative">
          <svg
            ref={salesRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair select-none"
            onMouseMove={(e) => handleMouseMove(e, salesPoints, setActiveIdxSales, salesRef)}
            onMouseLeave={() => setActiveIdxSales(null)}
          >
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {getGridValues(maxSales).map((val, i) => {
              const y = padding.top + chartHeight - (val / maxSales) * chartHeight;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#f3f4f6"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? "0" : "4 4"}
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[9px] fill-neutral-400 font-mono"
                  >
                    {Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Labels (draw 4 labels) */}
            {data.length > 1 &&
              [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1].map((idx) => {
                const p = salesPoints[idx];
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className="text-[9px] fill-neutral-400"
                  >
                    {formatXLabel(p.date)}
                  </text>
                );
              })}

            {/* Area & Line */}
            <path d={salesAreaPath} fill="url(#salesGrad)" />
            <path d={salesLinePath} fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />

            {/* Active hover highlights */}
            {activeIdxSales !== null && (
              <g>
                <line
                  x1={salesPoints[activeIdxSales].x}
                  y1={padding.top}
                  x2={salesPoints[activeIdxSales].x}
                  y2={height - padding.bottom}
                  stroke="#e5e7eb"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={salesPoints[activeIdxSales].x}
                  cy={salesPoints[activeIdxSales].y}
                  r="5"
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="shadow-sm"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 2. REVENUE CHART */}
      <div className="border border-neutral-100 bg-white rounded-2xl p-6 shadow-sm relative">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Tren Pendapatan</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">30 Hari Terakhir</p>
          </div>
          {activeIdxRev !== null && (
            <div className="text-right">
              <span className="text-xs font-bold text-neutral-900">{formatRupiah(revPoints[activeIdxRev].val)}</span>
              <p className="text-[10px] text-neutral-400">{formatXLabel(revPoints[activeIdxRev].date)}</p>
            </div>
          )}
        </div>

        <div className="relative">
          <svg
            ref={revRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible cursor-crosshair select-none"
            onMouseMove={(e) => handleMouseMove(e, revPoints, setActiveIdxRev, revRef)}
            onMouseLeave={() => setActiveIdxRev(null)}
          >
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {getGridValues(maxRev).map((val, i) => {
              const y = padding.top + chartHeight - (val / maxRev) * chartHeight;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#f3f4f6"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? "0" : "4 4"}
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[9px] fill-neutral-400 font-mono"
                  >
                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : val >= 1000 ? `${val / 1000}rb` : val}
                  </text>
                </g>
              );
            })}

            {/* X-Axis Labels */}
            {data.length > 1 &&
              [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1].map((idx) => {
                const p = revPoints[idx];
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className="text-[9px] fill-neutral-400"
                  >
                    {formatXLabel(p.date)}
                  </text>
                );
              })}

            {/* Area & Line */}
            <path d={revAreaPath} fill="url(#revGrad)" />
            <path d={revLinePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

            {/* Active hover highlights */}
            {activeIdxRev !== null && (
              <g>
                <line
                  x1={revPoints[activeIdxRev].x}
                  y1={padding.top}
                  x2={revPoints[activeIdxRev].x}
                  y2={height - padding.bottom}
                  stroke="#e5e7eb"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={revPoints[activeIdxRev].x}
                  cy={revPoints[activeIdxRev].y}
                  r="5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="shadow-sm"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
