"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, OrderIntent } from "@/lib/supabase";
import { 
  CheckCircle2, Clock, Truck, Store, Copy, Upload, Loader2, MapPin, 
  PackageCheck, Package, Check, ZoomIn, X, AlertCircle, ExternalLink
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
  const [isMounted, setIsMounted] = useState(false);
  const [copiedResi, setCopiedResi] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(initialOrder?.payment_proof_url || null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isQrisZoomed, setIsQrisZoomed] = useState(false);

  // Poll database for real-time status & resi updates via secure server API route
  const fetchOrderFromDb = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/status?code=${encodeURIComponent(orderId)}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setOrder(json.data as OrderIntent);
        if (json.data.payment_proof_url) {
          setProofUrl(json.data.payment_proof_url);
        }
      }
    } catch (err) {
      console.warn("Polling order error:", err);
    }
  }, [orderId]);

  useEffect(() => {
    setIsMounted(true);

    // 1. Try local storage fallback if initialOrder is not available
    if (!initialOrder) {
      try {
        const saved = localStorage.getItem(`alparfume_order_${orderId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setOrder((prev) => prev || ({
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
          } as unknown as OrderIntent));
          if (parsed.paymentProofUrl) {
            setProofUrl(parsed.paymentProofUrl);
          }
        }
      } catch (err) {
        console.error("Local storage load error:", err);
      }
    }

    // 2. Initial fetch & setup polling every 3 seconds for instant live updates
    fetchOrderFromDb();
    const interval = setInterval(() => {
      fetchOrderFromDb();
    }, 3000);

    // 3. Supabase Realtime Subscription for instant status updates from Admin
    const channel = supabase
      .channel(`order_live_${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchOrderFromDb();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_intents",
        },
        () => {
          fetchOrderFromDb();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [orderId, initialOrder, fetchOrderFromDb]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  const handleCopyResi = (resi: string) => {
    navigator.clipboard.writeText(resi);
    setCopiedResi(true);
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File harus berupa gambar (JPG, PNG, WEBP)");
      return;
    }

    setUploadingProof(true);
    setUploadError("");
    setUploadSuccess(false);

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

  // Parse nested items_json metadata if present
  let itemsMeta: Record<string, unknown> = {};
  if (order?.items_json) {
    try {
      let parsed = typeof order.items_json === "string" ? JSON.parse(order.items_json) : order.items_json;
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        itemsMeta = parsed as Record<string, unknown>;
      }
    } catch {}
  }

  const addressLower = (order?.customer_address || "").toLowerCase();
  const paymentMethodLower = (order?.payment_method || "").toLowerCase();
  const courierNameLower = (order?.courier_name || "").toLowerCase();
  const deliveryMethodLower = (order?.delivery_method || String(itemsMeta.delivery_method || "")).toLowerCase();
  const itemsJsonStr = (order?.items_json || "").toLowerCase();

  const isQris =
    paymentMethodLower === "qris" ||
    itemsJsonStr.includes('"payment_method":"qris"');

  const isPickup =
    deliveryMethodLower === "pickup" ||
    paymentMethodLower === "cod_pickup" ||
    courierNameLower.includes("toko") ||
    courierNameLower.includes("ambil") ||
    addressLower.includes("ambil di toko") ||
    addressLower.includes("toko madiun") ||
    itemsJsonStr.includes('"payment_method":"cod_pickup"') ||
    itemsJsonStr.includes('"delivery_method":"pickup"');

  const isCodCourier =
    !isPickup && !isQris && (
      paymentMethodLower === "cod" ||
      paymentMethodLower === "cod_courier" ||
      itemsJsonStr.includes('"payment_method":"cod"') ||
      itemsJsonStr.includes('"payment_method":"cod_courier"')
    );

  // Order Tracking Status Calculation from top-level & items_json fields
  const localFulfill = isMounted && typeof window !== "undefined"
    ? (localStorage.getItem(`alparfume_intent_fulfill_${orderId}`) || (order?.order_code ? localStorage.getItem(`alparfume_intent_fulfill_${order.order_code}`) : "") || "").toLowerCase()
    : "";

  const rawTopFulfill = String(order?.fulfillment_status || "").toLowerCase();
  const rawMetaFulfill = String(itemsMeta.fulfillment_status || itemsMeta.fulfillmentStatus || "").toLowerCase();
  const rawTopPay = String(order?.payment_status || "").toLowerCase();
  const rawMetaPay = String(itemsMeta.payment_status || itemsMeta.paymentStatus || "").toLowerCase();
  const effectiveTrackingNumber = order?.tracking_number || (itemsMeta.tracking_number as string) || (itemsMeta.trackingNumber as string);

  const isPaid = rawTopPay === "paid" || rawMetaPay === "paid";
  const isShipped = !!effectiveTrackingNumber || localFulfill.includes("shipped") || rawTopFulfill.includes("shipped") || rawTopFulfill.includes("kirim") || rawMetaFulfill.includes("shipped") || rawMetaFulfill.includes("kirim");
  const isCompleted = rawTopFulfill.includes("completed") || rawTopFulfill.includes("selesai") || rawMetaFulfill.includes("completed") || rawMetaFulfill.includes("selesai") || localFulfill.includes("completed") || localFulfill.includes("selesai") || itemsJsonStr.includes("completed") || itemsJsonStr.includes("selesai");
  const isReadyForPickup = localFulfill.includes("ready") || localFulfill.includes("siap") || rawTopFulfill.includes("ready") || rawTopFulfill.includes("siap") || rawMetaFulfill.includes("ready") || rawMetaFulfill.includes("siap") || itemsJsonStr.includes("ready_for_pickup");
  const isProcessing = isPaid || rawTopFulfill.includes("process") || rawTopFulfill.includes("kemas") || rawMetaFulfill.includes("process") || rawMetaFulfill.includes("kemas");

  // Step calculation logic
  let currentStep = 1;
  if (isPickup) {
    if (isCompleted) {
      currentStep = 3;
    } else if (isReadyForPickup || isShipped) {
      currentStep = 2;
    } else {
      currentStep = 1;
    }
  } else if (isCodCourier) {
    if (isCompleted) {
      currentStep = 4;
    } else if (isShipped) {
      currentStep = 3;
    } else {
      currentStep = 2;
    }
  } else {
    // Regular Courier (QRIS)
    if (isCompleted) {
      currentStep = 4;
    } else if (isShipped) {
      currentStep = 3;
    } else if (isProcessing || isPaid) {
      currentStep = 2;
    } else {
      currentStep = 1;
    }
  }

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="bg-emerald-600 text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5" /> Pesanan Selesai
        </span>
      );
    }

    if (isPickup) {
      if (isReadyForPickup || isShipped) {
        return (
          <span className="bg-emerald-500 text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs animate-pulse">
            <Store className="w-3.5 h-3.5" /> Siap Diambil di Toko
          </span>
        );
      }
      return (
        <span className="bg-white text-black font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-black flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5" /> Ambil di Toko ({isQris ? "QRIS" : "COD"})
        </span>
      );
    }

    if (isCodCourier) {
      if (isShipped) {
        return (
          <span className="bg-amber-500 text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs animate-pulse">
            <Truck className="w-3.5 h-3.5" /> Kurir Mengantar Paket
          </span>
        );
      }
      return (
        <span className="bg-amber-100 text-amber-900 font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-amber-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> COD (Bayar di Tempat)
        </span>
      );
    }

    if (isShipped) {
      return (
        <span className="bg-black text-white font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-xs">
          <Truck className="w-3.5 h-3.5" /> Dalam Pengiriman Kurir
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

    if (proofUrl) {
      return (
        <span className="bg-amber-50 text-amber-800 font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-amber-200 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 animate-spin" /> Menunggu Verifikasi Bukti
        </span>
      );
    }

    return (
      <span className="bg-neutral-100 text-neutral-800 font-semibold px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest border border-neutral-300 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Menunggu Pembayaran QRIS
      </span>
    );
  };

  const formattedCode = order?.order_code || orderId;

  // Parse items array from items_json or single product fallback
  let itemsList: { productName: string; sizeMl: number; quantity: number; price: number; totalItemPrice: number }[] = [];
  if (itemsMeta.items && Array.isArray(itemsMeta.items) && itemsMeta.items.length > 0) {
    itemsList = itemsMeta.items as { productName: string; sizeMl: number; quantity: number; price: number; totalItemPrice: number }[];
  } else if (order?.items_json) {
    try {
      const parsed = typeof order.items_json === "string" ? JSON.parse(order.items_json) : order.items_json;
      if (Array.isArray(parsed)) {
        itemsList = parsed;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        itemsList = parsed.items;
      }
    } catch {}
  }

  if (itemsList.length === 0 && order) {
    itemsList = [
      {
        productName: order.product_name || "Parfum AL Parfume",
        sizeMl: order.size_ml || 35,
        quantity: 1,
        price: order.total_price || order.price || 0,
        totalItemPrice: order.total_price || order.price || 0,
      },
    ];
  }

  const subtotal = Number(itemsMeta.subtotal) || (itemsList.reduce((acc, curr) => acc + (curr.totalItemPrice || (curr.price * curr.quantity)), 0)) || (order?.total_price || order?.price || 0);
  const shippingCost = Number(itemsMeta.shipping_cost || order?.shipping_cost || 0);
  const grandTotal = Number(itemsMeta.grand_total || order?.total_price || order?.price || (subtotal + shippingCost));

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Store AL Parfume, Jl. Teratai No. 45, Madiun, Jawa Timur")}`;

  const renderPickupStoreCard = () => (
    <div className="bg-white border border-brandBorder p-6 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 text-brandBlack font-bold text-sm uppercase tracking-wider border-b pb-3">
        <Store className="w-4 h-4 text-emerald-600" /> Lokasi Ambil di Toko
      </div>
      <p className="text-xs text-neutral-600 leading-relaxed font-sans">
        Silakan tunjukkan Kode Pesanan <span className="font-bold font-mono">#{formattedCode}</span> ke kasir toko saat mengambil parfum.
      </p>
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block bg-neutral-50 hover:bg-neutral-100 p-4 rounded-xl border border-neutral-200 hover:border-black/30 transition-all text-xs space-y-2 font-sans cursor-pointer"
      >
        <div className="font-semibold text-brandBlack group-hover:text-black flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            Store AL Parfume Madiun
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black transition-colors shrink-0" />
        </div>
        <p className="text-neutral-500 group-hover:text-neutral-700 text-[11px] leading-snug pl-5 underline underline-offset-2 decoration-neutral-300 group-hover:decoration-neutral-600">
          Jl. Teratai No. 45, Madiun, Jawa Timur (Buka Setiap Hari 09.00 - 21.00 WIB)
        </p>
      </a>
    </div>
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header Info */}
      <div className="bg-white border border-brandBorder p-6 md:p-8 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
          <div>
            <span className="text-xs text-neutral-400 font-mono tracking-wider block mb-1 uppercase">
              Kode Pesanan
            </span>
            <h1 className="text-2xl font-bold font-plus-jakarta text-brandBlack flex items-center gap-2">
              #{formattedCode}
            </h1>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Multi-step progress bar */}
        <div className="pt-2">
          <div className="text-xs text-neutral-500 font-medium mb-3 uppercase tracking-wider">
            Status Perjalanan Pesanan
          </div>

          {isPickup ? (
            /* Workflow Ambil di Toko */
            <div className="grid grid-cols-3 gap-2 relative">
              <div className={`p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 1 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Package className="w-4 h-4 mx-auto" />
                <div className="text-[10px] font-bold uppercase tracking-wider">1. Pesanan Diterima</div>
              </div>
              <div className={`p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 2 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Store className="w-4 h-4 mx-auto" />
                <div className="text-[10px] font-bold uppercase tracking-wider">2. Siap Diambil</div>
              </div>
              <div className={`p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 3 ? "bg-emerald-600 text-white border-emerald-600" : "bg-neutral-50 text-neutral-400 border-emerald-600"}`}>
                <CheckCircle2 className="w-4 h-4 mx-auto" />
                <div className="text-[10px] font-bold uppercase tracking-wider">3. Selesai (Diambil)</div>
              </div>
            </div>
          ) : isCodCourier ? (
            /* Workflow COD Kurir */
            <div className="grid grid-cols-4 gap-2 relative">
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 1 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Package className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">1. Diterima</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 2 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <PackageCheck className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">2. Dikemas</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 3 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Truck className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">3. Dikirim</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 4 ? "bg-emerald-600 text-white border-emerald-600" : "bg-neutral-50 text-neutral-400 border-emerald-600"}`}>
                <CheckCircle2 className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">4. Selesai</div>
              </div>
            </div>
          ) : (
            /* Workflow Kurir Regular QRIS */
            <div className="grid grid-cols-4 gap-2 relative">
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 1 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Clock className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">1. Bayar QRIS</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 2 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <PackageCheck className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">2. Dikemas</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 3 ? "bg-black text-white border-black" : "bg-neutral-50 text-neutral-400 border-neutral-200"}`}>
                <Truck className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">3. Dikirim</div>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl border text-center space-y-1 transition-all ${currentStep >= 4 ? "bg-emerald-600 text-white border-emerald-600" : "bg-neutral-50 text-neutral-400 border-emerald-600"}`}>
                <CheckCircle2 className="w-4 h-4 mx-auto" />
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">4. Selesai</div>
              </div>
            </div>
          )}
        </div>

        {/* Resi Box if Shipped */}
        {effectiveTrackingNumber && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Nomor Resi Pengiriman
                </div>
                <div className="text-base font-mono font-bold text-emerald-950">
                  {effectiveTrackingNumber}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleCopyResi(effectiveTrackingNumber)}
              className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedResi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedResi ? "Tersalin" : "Salin Resi"}
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: QRIS & Upload (or Pickup Banner) */}
        <div className="md:col-span-1 space-y-6">
          {isQris ? (
            <>
              {/* Regular QRIS Upload Box */}
              <div className="bg-white border border-brandBorder p-6 rounded-2xl space-y-5">
                <div className="border-b pb-3">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-brandBlack">
                    Pembayaran QRIS
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Scan QRIS di bawah ini dengan E-Wallet/Mobile Banking Anda.
                  </p>
                </div>

                {/* QRIS Image Code */}
                <div className="relative group bg-neutral-50 p-4 border rounded-xl flex flex-col items-center justify-center">
                  <Image
                    src="/qris.jpg"
                    alt="QRIS Al Parfume"
                    width={200}
                    height={200}
                    className="rounded-lg object-contain cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setIsQrisZoomed(true)}
                  />
                  <button
                    onClick={() => setIsQrisZoomed(true)}
                    className="mt-2 text-[10px] text-neutral-500 hover:text-black font-semibold flex items-center gap-1 uppercase tracking-wider"
                  >
                    <ZoomIn className="w-3 h-3" /> Perbesar QRIS
                  </button>
                </div>

                {/* Proof Image Upload Box */}
                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-brandBlack block">
                    Unggah Bukti Transfer
                  </label>

                  {proofUrl ? (
                    <div className="space-y-3">
                      <div className="relative border rounded-xl overflow-hidden group bg-neutral-100">
                        <Image
                          src={proofUrl}
                          alt="Bukti Transfer"
                          width={300}
                          height={300}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Bukti transfer tersimpan & menunggu verifikasi admin.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="border-2 border-dashed border-neutral-300 hover:border-black rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center bg-neutral-50/50">
                        {uploadingProof ? (
                          <Loader2 className="w-6 h-6 animate-spin text-neutral-600" />
                        ) : (
                          <Upload className="w-6 h-6 text-neutral-400" />
                        )}
                        <span className="text-xs font-semibold text-neutral-700">
                          {uploadingProof ? "Mengompres & Mengunggah..." : "Pilih Foto Bukti Transfer"}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Format JPG, PNG (Otomatis Diompres)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={uploadingProof}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {uploadError && (
                    <div className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {uploadError}
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="text-xs text-emerald-600 font-medium bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Bukti pembayaran berhasil diunggah!
                    </div>
                  )}
                </div>
              </div>

              {/* Store Pickup Card for Pickup+QRIS */}
              {isPickup && renderPickupStoreCard()}
            </>
          ) : isPickup ? (
            renderPickupStoreCard()
          ) : isCodCourier ? (
            <div className="bg-white border border-brandBorder p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-brandBlack font-bold text-sm uppercase tracking-wider border-b pb-3">
                <Clock className="w-4 h-4 text-amber-600" /> Pembayaran COD
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                Pesanan Anda akan dikirim via Kurir. Mohon siapkan uang tunai sebesar <span className="font-bold text-brandBlack">{formatRupiah(grandTotal)}</span> saat kurir datang.
              </p>
            </div>
          ) : null}
        </div>

        {/* Right Column: Order Items & Customer Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Items Summary */}
          <div className="bg-white border border-brandBorder p-6 rounded-2xl space-y-4 shadow-xs">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brandBlack border-b pb-3">
              Rincian Produk Dipesan
            </h3>

            <div className="divide-y divide-neutral-100">
              {itemsList.map((itm, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4 font-sans text-xs">
                  <div>
                    <div className="font-semibold text-brandBlack">{itm.productName}</div>
                    <div className="text-neutral-400 text-[11px]">
                      Ukuran: {itm.sizeMl}ml &bull; Qty: {itm.quantity}x
                    </div>
                  </div>
                  <div className="font-mono font-bold text-brandBlack">
                    {formatRupiah(itm.totalItemPrice || (itm.price * itm.quantity))}
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-t pt-4 space-y-2 font-sans text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal Produk</span>
                <span className="font-mono">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Ongkos Kirim ({isPickup ? "Ambil Toko" : "Kurir"})</span>
                <span className="font-mono">{shippingCost > 0 ? formatRupiah(shippingCost) : "Gratis"}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-brandBlack border-t pt-3">
                <span>Total Pembayaran</span>
                <span className="font-mono text-base">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white border border-brandBorder p-6 rounded-2xl space-y-4 shadow-xs">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brandBlack border-b pb-3">
              Informasi Pemesan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
              <div>
                <span className="text-neutral-400 uppercase tracking-wider text-[10px] block">Nama Pelanggan</span>
                <span className="font-semibold text-brandBlack text-sm">{order?.customer_name || "-"}</span>
              </div>
              <div>
                <span className="text-neutral-400 uppercase tracking-wider text-[10px] block">Nomor WhatsApp</span>
                <span className="font-mono font-semibold text-brandBlack">{order?.customer_wa || "-"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-neutral-400 uppercase tracking-wider text-[10px] block">Alamat Pengiriman / Tipe</span>
                <span className="text-neutral-700 leading-relaxed block mt-0.5">{order?.customer_address || (isPickup ? "Ambil di Toko AL Parfume Madiun" : "-")}</span>
              </div>
              {order?.order_notes && (
                <div className="sm:col-span-2 bg-neutral-50 p-3 rounded-xl border text-neutral-600">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Catatan Pesanan:</span>
                  {order.order_notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QRIS Zoom Modal */}
      {isQrisZoomed && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="relative bg-white p-6 rounded-3xl max-w-sm w-full space-y-4 animate-scale-up">
            <button
              onClick={() => setIsQrisZoomed(false)}
              className="absolute top-4 right-4 p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full text-neutral-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h4 className="font-bold text-sm uppercase tracking-wider text-brandBlack">Scan QRIS AL Parfume</h4>
              <p className="text-xs text-neutral-500 mt-1">Gunakan E-Wallet atau M-Banking</p>
            </div>
            <div className="bg-white p-2 border rounded-2xl flex justify-center">
              <Image src="/qris.jpg" alt="QRIS Zoom" width={320} height={320} className="rounded-xl object-contain" />
            </div>
            <button
              onClick={() => setIsQrisZoomed(false)}
              className="w-full py-2.5 bg-black text-white font-semibold text-xs rounded-xl uppercase tracking-wider"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
