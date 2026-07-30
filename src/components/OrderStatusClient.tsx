"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, OrderIntent } from "@/lib/supabase";
import { 
  CheckCircle2, Clock, Truck, Store, Copy, Upload, Loader2, MapPin, 
  Navigation, PackageCheck, Package, Check, ZoomIn, X, AlertCircle
} from "lucide-react";
import Image from "next/image";

interface OrderStatusClientProps {
  orderId: string;
  initialOrder: OrderIntent | null;
}

/**
 * Client-side image compressor using HTML Canvas
 * Resizes max width/height to 800px, quality 0.75 for crisp clear payment proofs
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxWidth = 800;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function OrderStatusClient({ orderId, initialOrder }: OrderStatusClientProps) {
  const [order, setOrder] = useState<OrderIntent | null>(initialOrder);
  const [copiedResi, setCopiedResi] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(initialOrder?.payment_proof_url || null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isQrisZoomed, setIsQrisZoomed] = useState(false);

  // Poll database for real-time status & resi updates
  const fetchOrderFromDb = useCallback(async () => {
    try {
      const numericId = parseInt(orderId, 10);
      if (isNaN(numericId)) return;

      const { data, error } = await supabase
        .from("order_intents")
        .select("*")
        .eq("id", numericId)
        .single();

      if (!error && data) {
        setOrder(data as OrderIntent);
        if (data.payment_proof_url) {
          setProofUrl(data.payment_proof_url);
        }
      }
    } catch (err) {
      console.warn("Polling order error:", err);
    }
  }, [orderId]);

  useEffect(() => {
    // 1. Try local storage fallback if initialOrder is not available
    if (!initialOrder) {
      try {
        const saved = localStorage.getItem(`alparfume_order_${orderId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setOrder({
            id: parsed.id,
            product_name: parsed.product_name,
            size_ml: parsed.size_ml,
            price: parsed.price,
            customer_name: parsed.customerName,
            customer_wa: parsed.customerWa,
            customer_address: parsed.customerAddress,
            payment_method: parsed.paymentMethod,
            payment_status: parsed.paymentStatus,
            payment_proof_url: parsed.paymentProofUrl || null,
            fulfillment_status: "pending",
            courier_name: parsed.courierName,
            shipping_cost: parsed.shippingCost,
            tracking_number: parsed.trackingNumber,
            total_price: parsed.grandTotal,
            created_at: parsed.createdAt,
          });
          if (parsed.paymentProofUrl) {
            setProofUrl(parsed.paymentProofUrl);
          }
        }
      } catch (err) {
        console.error("Local storage load error:", err);
      }
    }

    // 2. Initial fetch & setup polling every 7 seconds
    fetchOrderFromDb();
    const interval = setInterval(() => {
      fetchOrderFromDb();
    }, 7000);

    return () => clearInterval(interval);
  }, [orderId, initialOrder, fetchOrderFromDb]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  const handleCopyResi = (resi: string) => {
    navigator.clipboard.writeText(resi);
    setCopiedResi(true);
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    setUploadSuccess(false);
    setUploadError("");

    try {
      const compressedDataUrl = await compressImage(file);

      const res = await fetch("/api/orders/upload-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, proofUrl: compressedDataUrl }),
      });

      let finalSavedUrl = compressedDataUrl;
      if (res.ok) {
        const json = await res.json();
        if (json.proofUrl) {
          finalSavedUrl = json.proofUrl;
        }
        setProofUrl(finalSavedUrl);
        setUploadSuccess(true);
        setOrder((prev) => (prev ? { ...prev, payment_proof_url: finalSavedUrl, payment_status: "pending_verification" } : null));

        try {
          const saved = localStorage.getItem(`alparfume_order_${orderId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            parsed.paymentProofUrl = compressedDataUrl;
            localStorage.setItem(`alparfume_order_${orderId}`, JSON.stringify(parsed));
          }
        } catch {
          // Ignore quota limits
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setUploadError(errJson.error || "Gagal mengunggah bukti pembayaran.");
      }
    } catch (err) {
      console.error("Gagal mengunggah & mengompresi bukti pembayaran:", err);
      setUploadError("Terjadi kesalahan saat mengunggah bukti. Silakan coba lagi.");
    } finally {
      setUploadingProof(false);
    }
  };

  const isPickup =
    order?.payment_method === "cod_pickup" ||
    order?.courier_name === "Ambil di Toko" ||
    (order?.customer_address && order.customer_address.includes("AMBIL DI TOKO")) ||
    (order?.items_json &&
      (order.items_json.includes('"payment_method":"cod_pickup"') ||
        order.items_json.includes('"delivery_method":"pickup"')));

  // Order Tracking Status Calculation
  const isPaid = order?.payment_status === "paid";
  const isShipped = !!order?.tracking_number || order?.fulfillment_status === "shipped" || order?.fulfillment_status === "dikirim";
  const isCompleted = order?.fulfillment_status === "completed" || order?.fulfillment_status === "selesai";
  const isPacking = isPaid || order?.fulfillment_status === "packing" || order?.fulfillment_status === "dikemas";

  let currentStep = 1; // 1: Menunggu/Dibuat, 2: Dikemas, 3: Dikirim, 4: Selesai
  if (isCompleted) {
    currentStep = 4;
  } else if (isShipped) {
    currentStep = 3;
  } else if (isPacking) {
    currentStep = 2;
  }

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="bg-emerald-600 text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5" /> Pesanan Selesai
        </span>
      );
    }

    if (isShipped) {
      return (
        <span className="bg-black text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
          <Truck className="w-3.5 h-3.5" /> Dalam Pengiriman
        </span>
      );
    }

    if (isPickup) {
      return (
        <span className="bg-white text-black font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-black flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5" /> Ambil di Toko (COD)
        </span>
      );
    }

    if (isPaid) {
      return (
        <span className="bg-neutral-900 text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5 text-emerald-400" /> Dikemas (Lunas)
        </span>
      );
    }

    return (
      <span className="border border-neutral-700 text-neutral-300 font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 animate-pulse" /> Menunggu Verifikasi
      </span>
    );
  };

  const steps = isPickup
    ? [
        {
          title: "Pesanan Dibuat",
          desc: "Pesanan telah terdaftar",
          step: 1,
          icon: Clock,
        },
        {
          title: "Siap Diambil",
          desc: "Toko Al Parfume Madiun",
          step: 2,
          icon: Store,
        },
        {
          title: "Selesai (Diambil)",
          desc: "Diserahkan di toko",
          step: 3,
          icon: CheckCircle2,
        },
      ]
    : [
        {
          title: "Menunggu",
          desc: proofUrl ? "Bukti terunggah" : "Upload bukti QRIS",
          step: 1,
          icon: Clock,
        },
        {
          title: "Dikemas",
          desc: isPaid ? "Diverifikasi Admin" : "Proses kemas",
          step: 2,
          icon: Package,
        },
        {
          title: "Dikirim",
          desc: order?.tracking_number ? `Resi: ${order.tracking_number}` : "Kurir ekspedisi",
          step: 3,
          icon: Truck,
        },
        {
          title: "Selesai",
          desc: "Pesanan diterima",
          step: 4,
          icon: CheckCircle2,
        },
      ];

  return (
    <div className="space-y-8 font-sans max-w-3xl mx-auto">
      {/* Black & White Luxury Header Banner */}
      <div className="bg-black text-white rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm border border-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] font-semibold text-neutral-400 uppercase block">
              AL PARFUME &bull; PESANAN #{orderId}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-sans mt-1">
              {isPickup ? "Penjemputan Toko (COD)" : "Tracking & Status Pesanan"}
            </h1>
          </div>
          {getStatusBadge()}
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Metode: <strong className="text-white uppercase">{order?.payment_method === "cod_pickup" ? "Bayar di Tempat (COD)" : "QRIS Transfer"}</strong></span>
          <span>Total: <strong className="text-white font-mono">{formatRupiah(order?.total_price || 0)}</strong></span>
        </div>
      </div>

      {/* LIVE ORDER TRACKING PROGRESS STEPPER (Minimalist Monochrome B&W) */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">
              Status Pengiriman Real-Time
            </span>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              {isCompleted
                ? "Pesanan Anda Telah Selesai"
                : isShipped
                ? "Pesanan Sedang Dalam Pengiriman"
                : isPaid
                ? "Pesanan Sedang Dikemas"
                : "Menunggu Verifikasi Pembayaran"}
            </h2>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Live Update
          </span>
        </div>

        {/* Stepper Timeline Bar */}
        <div className="relative py-2">
          {/* Track background line */}
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-neutral-200 -z-0 hidden sm:block" />

          <div className={`grid ${isPickup ? "grid-cols-3" : "grid-cols-4"} gap-2 sm:gap-4 relative z-10`}>
            {steps.map((s) => {
              const Icon = s.icon;
              const isPast = currentStep > s.step;
              const isCurrent = currentStep === s.step;

              return (
                <div key={s.step} className="flex flex-col items-center text-center space-y-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isPast
                        ? "bg-black text-white shadow-xs"
                        : isCurrent
                        ? "bg-black text-white ring-4 ring-neutral-200 font-bold shadow-md"
                        : "bg-neutral-100 text-neutral-400 border border-neutral-200"
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <span
                      className={`text-xs font-bold block ${
                        isCurrent ? "text-black" : isPast ? "text-neutral-800" : "text-neutral-400"
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="text-[10px] text-neutral-400 block line-clamp-1 mt-0.5">
                      {s.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resi Tracking Box if Available */}
      {order?.tracking_number ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">
                Nomor Resi Pengiriman
              </span>
              <h2 className="text-xl font-bold text-black font-mono mt-0.5">
                {order.tracking_number}
              </h2>
            </div>
            <span className="text-xs font-semibold text-neutral-500 uppercase">
              {order.courier_name || "Ekspedisi"}
            </span>
          </div>

          <button
            onClick={() => handleCopyResi(order.tracking_number!)}
            className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedResi ? "Berhasil Disalin" : "Salin Nomor Resi"}
          </button>
        </div>
      ) : null}

      {/* COD / STORE PICKUP LOCATION & GOOGLE MAPS SECTION (Minimalist B&W) */}
      {isPickup ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="border-b border-neutral-100 pb-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">
                Petunjuk Lokasi Toko
              </span>
              <h2 className="text-lg font-bold text-neutral-900">
                Al Parfume Official Madiun
              </h2>
            </div>
            <span className="text-xs font-semibold font-mono bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full">
              Bayar Tunai: {formatRupiah(order?.total_price || 0)}
            </span>
          </div>

          <div className="space-y-6">
            {/* Address Box */}
            <div className="flex items-start gap-3.5 bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs">
              <div className="p-2.5 bg-black text-white rounded-lg shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="font-bold text-neutral-900 block uppercase tracking-wider text-[10px]">Alamat Pengambilan:</span>
                <p className="text-neutral-800 font-semibold leading-relaxed">
                  Dekat Jl. Mego Manis II No.10, Manisrejo, Kec. Taman, Kota Madiun, Jawa Timur 63138
                </p>
                <p className="text-[10px] text-neutral-400 font-mono pt-0.5">
                  Koordinat GPS: -7.6398704, 111.5431913
                </p>
              </div>
            </div>

            {/* Interactive Google Maps Embed (Minimal Black & White Frame) */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block">
                Peta Lokasi Toko (Google Maps)
              </span>
              <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border border-neutral-300 shadow-xs bg-neutral-100">
                <iframe
                  title="Lokasi Toko Al Parfume Madiun"
                  src="https://maps.google.com/maps?q=-7.6398704,111.5431913&z=17&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "contrast(1.05) grayscale(0.2)" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>

            {/* Direct Google Maps Action Button with Updated Link */}
            <div className="bg-black text-white p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-xs font-bold block uppercase tracking-wider">Navigasi Langsung</span>
                <span className="text-[11px] text-neutral-400 block font-light">
                  Buka rute terbaik menuju toko langsung di aplikasi Google Maps.
                </span>
              </div>

              <a
                href="https://maps.app.goo.gl/MmT7u43YTkRszmSL8"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-neutral-100 text-black font-semibold px-6 py-3 rounded-full text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer font-sans shrink-0"
              >
                <MapPin className="w-3.5 h-3.5" />
                Buka Google Maps
                <Navigation className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Simple Monochrome Notice */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600 space-y-1">
              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-black" /> Catatan Pengambilan:
              </div>
              <p className="leading-relaxed">
                Tunjukkan <strong>Nomor Pesanan #{orderId}</strong> saat tiba di toko. Pembayaran tunai sebesar <strong>{formatRupiah(order?.total_price || 0)}</strong> diserahkan langsung saat mengambil pesanan.
              </p>
            </div>
          </div>
        </div>
      ) : order?.payment_method === "qris" && order?.payment_status !== "paid" ? (
        /* QRIS PAYMENT & UPLOAD PROOF SECTION (Crisp HD QRIS Image & Minimalist B&W) */
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">
                Pembayaran Digital QRIS
              </span>
              <h2 className="text-lg font-bold text-neutral-900">
                Kode QRIS All E-Wallet & M-Banking
              </h2>
            </div>
            <span className="text-xs font-semibold font-mono bg-black text-white px-3.5 py-1 rounded-full">
              Total: {formatRupiah(order?.total_price || 0)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Crisp HD QRIS Code Box */}
            <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 text-center space-y-3">
              <span className="text-[10px] font-bold text-neutral-700 block uppercase tracking-wider">
                1. Pindai Kode QRIS Resmi
              </span>
              
              <div 
                onClick={() => setIsQrisZoomed(true)}
                className="relative mx-auto w-56 sm:w-64 aspect-[3/4] bg-white p-2 border border-neutral-200 rounded-xl shadow-xs flex items-center justify-center cursor-pointer group hover:border-black transition-all overflow-hidden"
              >
                <Image
                  src="/images/qris.jpg"
                  alt="Kode QRIS Al Parfume"
                  width={600}
                  height={800}
                  quality={100}
                  unoptimized
                  className="w-full h-full object-contain rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold rounded-xl gap-1">
                  <ZoomIn className="w-5 h-5" />
                  <span>Klik Perbesar QRIS</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-neutral-700 font-bold">
                  NMID: ID1026560637526 (Alparfumeco)
                </p>
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  Mendukung GoPay, OVO, Dana, ShopeePay, BCA, Mandiri & seluruh M-Banking.
                </p>
              </div>
            </div>

            {/* Upload Payment Proof Box */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-neutral-700 block uppercase tracking-wider">
                2. Upload Bukti Pembayaran
              </span>

              {proofUrl ? (
                <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      Bukti Bayar Terunggah
                    </span>
                  </div>

                  <div className="relative w-full h-40 bg-white rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src={proofUrl}
                      alt="Bukti Pembayaran QRIS"
                      fill
                      className="object-contain"
                    />
                  </div>

                  <label className="block text-center text-xs font-semibold text-neutral-700 hover:text-black cursor-pointer pt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofFileUpload}
                      className="hidden"
                    />
                    Ganti Foto Bukti Pembayaran
                  </label>
                </div>
              ) : (
                <div className="border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 rounded-xl p-6 text-center space-y-3 transition-colors">
                  {uploadingProof ? (
                    <div className="py-6 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
                      <p className="text-xs font-semibold text-neutral-700">Mengunggah...</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofFileUpload}
                        className="hidden"
                      />
                      <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-neutral-900 block">
                          Klik untuk Unggah Foto Bukti
                        </span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5">
                          Format JPG / PNG
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-neutral-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Bukti terunggah! Admin akan mengonfirmasi pesanan Anda.
                </div>
              )}

              {uploadError && (
                <div className="p-3 bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Order Summary & Customer Info (Monochrome Minimalist) */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        <h3 className="font-bold text-xs text-neutral-900 uppercase tracking-widest border-b border-neutral-100 pb-3">
          Ringkasan Pesanan
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1.5">
            <span className="text-neutral-400 uppercase tracking-widest font-bold text-[10px] block">
              Detail Produk
            </span>
            <div className="font-bold text-sm text-neutral-900">{order?.product_name || "Produk AL Parfume"}</div>
            <div className="text-neutral-600">Ukuran: {order?.size_ml || 30} ml</div>
            <div className="text-neutral-600">Total Pembayaran: <strong className="text-black font-mono">{formatRupiah(order?.total_price || 0)}</strong></div>
          </div>

          <div className="space-y-1.5">
            <span className="text-neutral-400 uppercase tracking-widest font-bold text-[10px] block">
              Tujuan Pengiriman / Penjemputan
            </span>
            <div className="font-bold text-neutral-900">{order?.customer_name || "-"} ({order?.customer_wa || "-"})</div>
            <div className="text-neutral-600 leading-relaxed">{order?.customer_address || "Ambil di Toko Madiun"}</div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN QRIS ZOOM MODAL */}
      {isQrisZoomed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-sans">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-neutral-900">
                  Kode QRIS Al Parfume
                </h3>
                <p className="text-xs text-neutral-500">
                  NMID: ID1026560637526 &bull; Scan via E-Wallet / Bank
                </p>
              </div>
              <button 
                onClick={() => setIsQrisZoomed(false)}
                className="p-1 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-[3/4] max-h-[70vh] bg-white rounded-2xl overflow-hidden border border-neutral-200 flex items-center justify-center p-2">
              <Image
                src="/images/qris.jpg"
                alt="Kode QRIS Pembayaran Al Parfume"
                width={800}
                height={1066}
                quality={100}
                unoptimized
                className="w-full h-full object-contain"
              />
            </div>

            <button
              onClick={() => setIsQrisZoomed(false)}
              className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-3 rounded-full text-xs uppercase tracking-wider"
            >
              Tutup QRIS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
