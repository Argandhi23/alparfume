"use client";

import { useState, useEffect } from "react";
import { OrderIntent } from "@/lib/supabase";
import { CheckCircle2, Clock, Truck, Store, Copy, Upload, Loader2 } from "lucide-react";
import Image from "next/image";

interface OrderStatusClientProps {
  orderId: string;
  initialOrder: OrderIntent | null;
}

/**
 * Client-side image compressor using HTML Canvas
 * Resizes max width/height to 1000px, quality 0.7 (Max size ~150KB - 300KB)
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxWidth = 500;
        const maxHeight = 500;
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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
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

  useEffect(() => {
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
  }, [orderId, initialOrder]);

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

    try {
      // Compress image on client-side (Max 1000px width/height, 70% JPEG quality)
      const compressedDataUrl = await compressImage(file);

      // Send compressed proof image to API endpoint (uses service role key to bypass RLS and upload to Supabase Storage if bucket exists)
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
      }

      setProofUrl(finalSavedUrl);
      setUploadSuccess(true);
      setOrder((prev) => (prev ? { ...prev, payment_proof_url: finalSavedUrl, payment_status: "pending_verification" } : null));

      // Update local storage receipt
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
    } catch (err) {
      console.error("Gagal mengunggah & mengompresi bukti pembayaran:", err);
      alert("Gagal mengunggah bukti pembayaran. Silakan coba lagi.");
    } finally {
      setUploadingProof(false);
    }
  };

  const getStatusBadge = () => {
    const isPaid = order?.payment_status === "paid" || order?.payment_method === "cod_pickup";
    const isShipped = !!order?.tracking_number || order?.fulfillment_status === "shipped";
    const isPickup = order?.payment_method === "cod_pickup" || order?.courier_name === "Ambil di Toko";

    if (isShipped) {
      return (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs">
          <Truck className="w-4 h-4 text-blue-600" />
          Pesanan Dalam Pengiriman (Resi Tersedia)
        </div>
      );
    }

    if (isPickup) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs">
          <Store className="w-4 h-4 text-emerald-600" />
          Siap Diambil di Toko (Bayar di Tempat)
        </div>
      );
    }

    if (isPaid) {
      return (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          Pembayaran Lunas &bull; Sedang Diproses
        </div>
      );
    }

    return (
      <div className="bg-neutral-50 border border-neutral-200 text-neutral-800 px-4 py-2 rounded-2xl flex items-center gap-2 font-bold text-xs">
        <Clock className="w-4 h-4 text-neutral-600 animate-pulse" />
        Menunggu Verifikasi QRIS Manual oleh Admin
      </div>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.25em] font-bold text-neutral-400 uppercase block font-sans">
              Status Pesanan #{orderId}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-sans">
              Detail Resi & Pembayaran
            </h1>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Resi Tracking Box if Available */}
      {order?.tracking_number ? (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 sm:p-8 space-y-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-700 block">
                Nomor Resi Pengiriman Ready!
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-950 font-mono">
                {order.tracking_number}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => handleCopyResi(order.tracking_number!)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer font-sans"
            >
              <Copy className="w-4 h-4" />
              {copiedResi ? "Berhasil Disalin!" : "Salin Nomor Resi"}
            </button>
            <span className="text-xs text-emerald-800 font-medium font-sans">
              Kurir: <strong className="uppercase">{order.courier_name || "Ekspedisi"}</strong>
            </span>
          </div>
        </div>
      ) : null}

      {/* QRIS PAYMENT & UPLOAD PROOF SECTION */}
      {order?.payment_method === "qris" && order?.payment_status !== "paid" && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 block">
                Langkah Pembayaran
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 font-sans">
                Pembayaran via QRIS All E-Wallet
              </h2>
            </div>
            <span className="text-xs font-extrabold bg-neutral-100 text-neutral-800 px-3 py-1 rounded-full">
              Total: {formatRupiah(order.total_price || 0)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* QRIS Code Box */}
            <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200 text-center space-y-3">
              <span className="text-xs font-bold text-neutral-700 block uppercase tracking-wider">
                1. Scan Kode QRIS Di Bawah Ini
              </span>
              <div className="relative mx-auto w-52 h-52 bg-white p-3 border border-neutral-200 rounded-2xl shadow-sm flex items-center justify-center">
                <Image
                  src="/icon.png"
                  alt="Kode QRIS Al Parfume"
                  width={180}
                  height={180}
                  className="object-contain"
                />
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed font-sans">
                Mendukung <strong>GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, BRI, BNI</strong> dan semua perbankan.
              </p>
            </div>

            {/* Upload Payment Proof Box */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-neutral-700 block uppercase tracking-wider">
                2. Upload Bukti Pembayaran
              </span>

              {proofUrl ? (
                <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-neutral-600" />
                      Bukti Pembayaran Terunggah
                    </span>
                  </div>

                  <div className="relative w-full h-44 bg-neutral-200 rounded-xl overflow-hidden border border-neutral-300">
                    <Image
                      src={proofUrl}
                      alt="Bukti Pembayaran QRIS"
                      fill
                      className="object-contain"
                    />
                  </div>

                  <label className="block text-center text-xs font-bold text-neutral-700 hover:text-black cursor-pointer pt-1">
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
                <div className="border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 rounded-2xl p-6 text-center space-y-3 transition-colors">
                  {uploadingProof ? (
                    <div className="py-6 space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-black" />
                      <p className="text-xs font-bold text-neutral-700">Mengunggah Gambar...</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofFileUpload}
                        className="hidden"
                      />
                      <div className="w-12 h-12 bg-white rounded-full border border-neutral-200 shadow-sm flex items-center justify-center mx-auto text-neutral-700">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-neutral-900 block font-sans">
                          Klik untuk Upload Foto Bukti Pembayaran
                        </span>
                        <span className="text-[10px] text-neutral-500 font-sans block mt-0.5">
                          Format JPG / PNG
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-neutral-100 text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-neutral-700" />
                  Bukti berhasil diunggah! Admin akan segera mengonfirmasi pesanan Anda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Summary & Customer Info */}
      <div className="bg-white border border-neutral-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-3">
          Ringkasan Pesanan
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-sans">
          <div className="space-y-2">
            <span className="text-neutral-400 uppercase tracking-wider font-bold text-[10px] block">
              Detail Produk
            </span>
            <div className="font-bold text-sm text-neutral-900">{order?.product_name || "Produk AL Parfume"}</div>
            <div className="text-neutral-600">Ukuran: {order?.size_ml || 30} ml</div>
            <div className="text-neutral-600">Total Harga: <strong className="text-black">{formatRupiah(order?.total_price || 0)}</strong></div>
          </div>

          <div className="space-y-2">
            <span className="text-neutral-400 uppercase tracking-wider font-bold text-[10px] block">
              Tujuan Pengiriman
            </span>
            <div className="font-bold text-neutral-900">{order?.customer_name || "-"} ({order?.customer_wa || "-"})</div>
            <div className="text-neutral-600 leading-relaxed">{order?.customer_address || "Ambil di Toko"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
