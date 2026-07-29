"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, OrderIntent } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { 
  Trash2, Loader2, X, Image as ImageIcon, Truck, ChevronLeft, ChevronRight, Download,
  CheckCircle2, Clock, Store
} from "lucide-react";

interface CartItemMeta {
  productName?: string;
  product_name?: string;
  sizeMl?: number;
  size_ml?: number;
  quantity?: number;
  [key: string]: unknown;
}

export default function OrdersPage() {
  const [intents, setIntents] = useState<OrderIntent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Pagination
  const [intentsPage, setIntentsPage] = useState(1);
  const intentsLimit = 10;
  const [totalIntentsCount, setTotalIntentsCount] = useState(0);

  // Checkbox multi-select states
  const [selectedIntentIds, setSelectedIntentIds] = useState<string[]>([]);
  const [deleteIntentTargetIds, setDeleteIntentTargetIds] = useState<string[]>([]);
  const [isDeleteIntentModalOpen, setIsDeleteIntentModalOpen] = useState(false);
  const [deletingIntent, setDeletingIntent] = useState(false);

  // Resi & QRIS Order Management States
  const [isResiModalOpen, setIsResiModalOpen] = useState(false);
  const [selectedIntentForResi, setSelectedIntentForResi] = useState<OrderIntent | null>(null);
  const [resiInput, setResiInput] = useState("");
  const [savingResi, setSavingResi] = useState(false);
  const [viewingProofIntent, setViewingProofIntent] = useState<OrderIntent | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [deletingProof, setDeletingProof] = useState(false);

  const handleDeleteProof = async (intent: OrderIntent) => {
    if (!confirm(`Hapus foto bukti pembayaran untuk pesanan ${intent.customer_name || ""}? Ini akan membebaskan ruang di Supabase Storage.`)) return;
    
    setDeletingProof(true);
    try {
      const res = await fetch("/api/admin/intents/delete-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: intent.id }),
      });

      if (res.ok) {
        setIntents((prev) =>
          prev.map((item) =>
            item.id === intent.id
              ? { ...item, payment_proof_url: null }
              : item
          )
        );
        if (viewingProofIntent?.id === intent.id) {
          setViewingProofIntent(null);
        }
        alert("Bukti pembayaran berhasil dihapus dari storage!");
        fetchIntents(intentsPage, true);
      } else {
        const errJson = await res.json();
        alert(`Gagal menghapus bukti: ${errJson.error || "Terjadi kesalahan"}`);
      }
    } catch (err) {
      console.error("Gagal hapus bukti:", err);
      alert("Terjadi kesalahan saat menghapus bukti pembayaran.");
    } finally {
      setDeletingProof(false);
    }
  };

  const fetchIntents = useCallback(async (page: number = 1, silent: boolean = false) => {
    if (!silent) setLoadingData(true);
    try {
      let fetchedSuccessfully = false;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      try {
        const response = await fetch(`/api/admin/intents?page=${page}&limit=${intentsLimit}&_t=${Date.now()}`, {
          cache: "no-store",
          headers: token ? {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          } : {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            setIntents(result.data);
            setTotalIntentsCount(result.totalCount || result.data.length || 0);
            setIntentsPage(page);
            if (!silent) setSelectedIntentIds([]);
            fetchedSuccessfully = true;
          }
        }
      } catch (apiErr) {
        console.warn("API route fetch notice, falling back to direct client fetch:", apiErr);
      }

      if (!fetchedSuccessfully) {
        const from = (page - 1) * intentsLimit;
        const to = from + intentsLimit - 1;

        const { data, count, error } = await supabase
          .from("order_intents")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (!error && data) {
          setIntents(data);
          setTotalIntentsCount(count || data.length || 0);
          if (!silent) setSelectedIntentIds([]);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data pesanan:", err);
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, [intentsLimit]);

  useEffect(() => {
    fetchIntents(intentsPage);
    const interval = setInterval(() => {
      fetchIntents(intentsPage, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [intentsPage, fetchIntents]);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let allIntents: OrderIntent[] = [];

      try {
        const response = await fetch(`/api/admin/intents?limit=all&_t=${Date.now()}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const result = await response.json();
          allIntents = result.data || [];
        }
      } catch {}

      if (allIntents.length === 0) {
        const { data } = await supabase
          .from("order_intents")
          .select("*")
          .order("created_at", { ascending: false });
        allIntents = data || [];
      }

      if (allIntents.length === 0) {
        alert("Tidak ada data pesanan untuk diekspor.");
        return;
      }

      const title = "LAPORAN PESANAN AL PARFUME";
      const printDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let totalRevenue = 0;
      let rowsHtml = "";

      allIntents.forEach((order, index) => {
        const orderPrice = order.total_price || order.price || 0;
        totalRevenue += orderPrice;

        const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        let productDetails = "";
        if (order.items_json) {
          try {
            const parsed = JSON.parse(order.items_json);
            let itemsArray: CartItemMeta[] = [];
            if (Array.isArray(parsed)) {
              itemsArray = parsed;
            } else if (parsed.cartItems && Array.isArray(parsed.cartItems)) {
              itemsArray = parsed.cartItems;
            }
            if (itemsArray.length > 0) {
              productDetails = itemsArray
                .map((item) => `- ${item.productName || item.product_name || "Produk"} ${item.sizeMl || item.size_ml || 50}ml (Qty: ${item.quantity || 1})`)
                .join("<br>");
            }
          } catch {
            productDetails = `${order.product_name || "Produk"} (${order.size_ml || "-"}ml)`;
          }
        } else {
          productDetails = `${order.product_name || "Produk"} (${order.size_ml || "-"}ml)`;
        }

        rowsHtml += `
          <tr>
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; white-space: nowrap;">${orderDate}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; font-weight: 500;">${order.customer_name || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; mso-number-format:'\@';">${order.customer_wa || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px;">${order.customer_address || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; font-family: monospace; font-size: 11px;">${productDetails}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${order.tracking_number || "Belum ada resi"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">${orderPrice}</td>
          </tr>
        `;
      });

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Daftar Pesanan</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <h2 style="margin: 0; color: #111827;">${title}</h2>
          <p style="margin: 4px 0 24px 0; font-size: 12px; color: #4b5563;">Tanggal Cetak: ${printDate}</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 13px;">
            <thead>
              <tr style="background-color: #1f2937; color: #ffffff;">
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: center; width: 50px;">No</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 150px;">Tanggal Pesanan</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 180px;">Nama Pelanggan</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 130px;">No. WhatsApp</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 300px;">Alamat Pengiriman</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 250px;">Detail Produk</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: center; width: 150px;">No. Resi</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: right; width: 120px;">Total (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="7" style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">TOTAL PENDAPATAN:</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; color: #059669;">${totalRevenue}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Pesanan_AlParfume_${Date.now()}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mengekspor data ke Excel:", err);
      alert("Gagal mengekspor data ke Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleTogglePaymentStatus = async (intent: OrderIntent) => {
    try {
      const localStatus = typeof window !== "undefined" ? localStorage.getItem(`alparfume_intent_status_${intent.id}`) : null;
      let isPaid = localStatus === "paid" || intent.payment_status === "paid";
      let parsedObj: Record<string, unknown> | null = null;

      if (intent.items_json) {
        try {
          const parsed = JSON.parse(intent.items_json);
          if (parsed && typeof parsed === "object") {
            if (!Array.isArray(parsed)) {
              parsedObj = parsed as Record<string, unknown>;
              if (parsedObj.payment_status === "paid") {
                isPaid = true;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const nextStatus = isPaid ? "pending_verification" : "paid";

      // 1. Save to local storage for bulletproof client persistence
      if (typeof window !== "undefined") {
        localStorage.setItem(`alparfume_intent_status_${intent.id}`, nextStatus);
      }

      let updatedItemsJson = intent.items_json || "";
      if (parsedObj) {
        parsedObj.payment_status = nextStatus;
        updatedItemsJson = JSON.stringify(parsedObj);
      } else if (intent.items_json) {
        try {
          const parsed = JSON.parse(intent.items_json);
          if (Array.isArray(parsed)) {
            updatedItemsJson = JSON.stringify({
              cartItems: parsed,
              payment_status: nextStatus,
            });
          } else {
            updatedItemsJson = JSON.stringify({
              items: parsed,
              payment_status: nextStatus,
            });
          }
        } catch {
          updatedItemsJson = JSON.stringify({
            payment_status: nextStatus,
          });
        }
      } else {
        updatedItemsJson = JSON.stringify({
          payment_status: nextStatus,
        });
      }

      // 2. Optimistically update React state
      setIntents((prev) =>
        prev.map((item) =>
          item.id === intent.id
            ? { ...item, payment_status: nextStatus, items_json: updatedItemsJson }
            : item
        )
      );

      // 3. Send API PATCH update
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      try {
        await fetch("/api/admin/intents", {
          method: "PATCH",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: intent.id,
            updates: {
              payment_status: nextStatus,
              items_json: updatedItemsJson,
            },
          }),
        });
      } catch (apiErr) {
        console.warn("API route PATCH error:", apiErr);
      }

      // 4. Fallback client update
      await supabase
        .from("order_intents")
        .update({
          payment_status: nextStatus,
          items_json: updatedItemsJson,
        })
        .eq("id", intent.id);

    } catch (err) {
      console.error("Gagal mengubah status pembayaran:", err);
    }
  };

  const handleDeleteIntents = async () => {
    if (deleteIntentTargetIds.length === 0) return;
    setDeletingIntent(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch('/api/admin/intents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ ids: deleteIntentTargetIds }),
      });

      if (!response.ok) {
        await supabase.from("order_intents").delete().in("id", deleteIntentTargetIds);
      }

      deleteIntentTargetIds.forEach(id => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`alparfume_intent_status_${id}`);
        }
      });

      setSelectedIntentIds([]);
      setIsDeleteIntentModalOpen(false);
      
      const remainingOnPage = intents.length - deleteIntentTargetIds.length;
      const targetPage = remainingOnPage === 0 && intentsPage > 1 ? intentsPage - 1 : intentsPage;
      
      await fetchIntents(targetPage);
    } catch (err) {
      console.error("Gagal menghapus riwayat pesanan:", err);
      alert("Gagal menghapus riwayat pesanan. Silakan coba lagi.");
    } finally {
      setDeletingIntent(false);
      setDeleteIntentTargetIds([]);
    }
  };

  const handleOpenResiModal = (intent: OrderIntent) => {
    setSelectedIntentForResi(intent);
    setResiInput(intent.tracking_number || "");
    setIsResiModalOpen(true);
  };

  const handleSaveResi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntentForResi) return;
    setSavingResi(true);
    try {
      const trackingNo = resiInput.trim() || null;
      const updates = {
        tracking_number: trackingNo,
        fulfillment_status: trackingNo ? "shipped" : "pending",
        payment_status: "paid"
      };

      if (typeof window !== "undefined") {
        localStorage.setItem(`alparfume_intent_status_${selectedIntentForResi.id}`, "paid");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      try {
        await fetch("/api/admin/intents", {
          method: "PATCH",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            id: selectedIntentForResi.id,
            updates,
          }),
        });
      } catch (apiErr) {
        console.warn("API route PATCH error:", apiErr);
      }

      await supabase
        .from("order_intents")
        .update(updates)
        .eq("id", selectedIntentForResi.id);

      if (trackingNo && selectedIntentForResi.customer_wa) {
        let waNumber = selectedIntentForResi.customer_wa.replace(/\D/g, "");
        if (waNumber.startsWith("0")) {
          waNumber = "62" + waNumber.substring(1);
        }

        let courierName = "Ekspedisi";
        try {
           const parsed = JSON.parse(selectedIntentForResi.items_json || "");
           if (parsed.courier_name) courierName = parsed.courier_name;
        } catch {}

        const message = `Halo Kak ${selectedIntentForResi.customer_name},\n\nTerima kasih telah berbelanja di *Al Parfume*! 💖\n\nPesanan Kakak telah kami serahkan ke pihak kurir (${courierName}) dan saat ini sedang dalam proses pengiriman.\n\n📦 *Nomor Resi:* ${trackingNo}\n\nKakak bisa memantau status pesanan dari link berikut:\n${window.location.origin}/orders/${selectedIntentForResi.id}\n\nSemoga parfumnya sampai dengan aman dan Kakak suka wanginya! 🥰`;
        
        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
      }

      setIsResiModalOpen(false);
      fetchIntents(intentsPage);
    } catch (err) {
      console.error("Gagal menyimpan resi:", err);
    } finally {
      setSavingResi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Daftar Pesanan</h2>
          <p className="text-xs text-neutral-500 font-sans">Pantau transaksi dan kelola status pengiriman (Diperbarui otomatis tiap 15 detik)</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm transition-all font-sans disabled:opacity-50"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Ekspor Excel
          </button>

          {selectedIntentIds.length > 0 && (
            <button
              onClick={() => {
                setDeleteIntentTargetIds(selectedIntentIds);
                setIsDeleteIntentModalOpen(true);
              }}
              className="bg-rose-500 text-white hover:bg-rose-600 px-5 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Hapus ({selectedIntentIds.length}) Pilihan
            </button>
          )}
        </div>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
        </div>
      ) : intents.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <p className="text-xs tracking-widest text-neutral-400 uppercase font-bold">Belum ada pesanan</p>
        </div>
      ) : (
        <div className="border border-neutral-100 bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-400 tracking-wider uppercase font-semibold text-[10px] font-sans">
                  <th className="py-4 px-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer"
                      checked={selectedIntentIds.length === intents.length && intents.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIntentIds(intents.map(i => i.id.toString()));
                        } else {
                          setSelectedIntentIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="py-4 px-6 w-32">Waktu</th>
                  <th className="py-4 px-6 min-w-[150px]">Customer</th>
                  <th className="py-4 px-6 max-w-[200px]">Alamat</th>
                  <th className="py-4 px-6 w-48">Status Pembayaran</th>
                  <th className="py-4 px-6 w-44 text-center">Resi / Pengiriman</th>
                  <th className="py-4 px-6 w-56">Item Dipesan</th>
                  <th className="py-4 px-6 w-32 text-right">Total</th>
                  <th className="py-4 px-6 w-20 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {intents.map((int) => {
                  let items: CartItemMeta[] = [];
                  let parsedMeta: Record<string, unknown> = {};
                  const itemsJsonString = int.items_json || "";
                  
                  if (itemsJsonString) {
                    try {
                      const parsed = JSON.parse(itemsJsonString);
                      if (Array.isArray(parsed)) {
                        items = parsed;
                      } else if (parsed.cartItems && Array.isArray(parsed.cartItems)) {
                        items = parsed.cartItems;
                        parsedMeta = parsed;
                      } else {
                        items = [parsed];
                        parsedMeta = parsed;
                      }
                    } catch {
                      items = [];
                    }
                  }

                  const effectivePaymentMethod = parsedMeta.paymentMethod || int.payment_method;
                  
                  const localStatus = typeof window !== "undefined" ? localStorage.getItem(`alparfume_intent_status_${int.id}`) : null;
                  
                  let effectivePaymentStatus = "pending_verification";
                  if (localStatus === "paid" || int.payment_status === "paid" || (parsedMeta && !Array.isArray(parsedMeta) && parsedMeta.payment_status === "paid")) {
                    effectivePaymentStatus = "paid";
                  } else if (localStatus === "pending_verification") {
                    effectivePaymentStatus = "pending_verification";
                  } else if (int.payment_status) {
                    effectivePaymentStatus = int.payment_status;
                  } else if (parsedMeta && !Array.isArray(parsedMeta) && typeof parsedMeta.payment_status === "string") {
                    effectivePaymentStatus = parsedMeta.payment_status as string;
                  }

                  let effectiveProofUrl = int.payment_proof_url;
                  if (parsedMeta && !Array.isArray(parsedMeta) && typeof parsedMeta.payment_proof_url === "string") {
                    effectiveProofUrl = parsedMeta.payment_proof_url;
                  }
                  if (!effectiveProofUrl && itemsJsonString) {
                    const urlMatch = itemsJsonString.match(/https?:\/\/[^\s"'\\]+/i) || itemsJsonString.match(/data:image\/[a-zA-Z]+;base64,[^\s"'\\]+/i);
                    if (urlMatch) {
                      effectiveProofUrl = urlMatch[0];
                    }
                  }
                  const effectiveTotalPrice = int.total_price || (parsedMeta.grand_total as number) || int.price || 0;
                  
                  return (
                    <tr key={int.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 text-xs">
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIntentIds.includes(int.id.toString())}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIntentIds([...selectedIntentIds, int.id.toString()]);
                            } else {
                              setSelectedIntentIds(selectedIntentIds.filter((id) => id !== int.id.toString()));
                            }
                          }}
                          className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-6 font-mono text-[10px] text-neutral-500 whitespace-nowrap">
                        {new Date(int.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </td>
                      <td className="py-4 px-6 font-sans">
                        <div className="font-semibold text-neutral-900">{int.customer_name || "-"}</div>
                        {int.customer_wa && (
                          <a
                            href={`https://wa.me/${int.customer_wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-green-600 hover:underline block mt-0.5"
                          >
                            {int.customer_wa}
                          </a>
                        )}
                      </td>
                      <td className="py-4 px-6 text-neutral-600 font-sans max-w-xs truncate" title={int.customer_address || ""}>
                        {int.customer_address || "-"}
                      </td>
                      <td className="py-4 px-6 font-sans space-y-2">
                        {/* Status Badge */}
                        {effectivePaymentStatus === "paid" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Terverifikasi (Lunas)
                          </span>
                        ) : effectivePaymentMethod === "cod_pickup" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            Ambil Toko (COD)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Belum Verifikasi
                          </span>
                        )}

                        {/* Action buttons / Proof link */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {effectiveProofUrl ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setViewingProofIntent(int)}
                                className="text-[10px] bg-neutral-900 hover:bg-black text-white font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                title="Lihat bukti transfer QRIS"
                              >
                                <ImageIcon className="w-3 h-3 text-amber-300" />
                                Lihat Bukti
                              </button>
                              <button
                                onClick={() => handleDeleteProof(int)}
                                className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 p-1 rounded-md cursor-pointer transition-all"
                                title="Hapus Bukti (Hemat Storage)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : effectivePaymentMethod === "qris" ? (
                            <span className="text-[10px] text-neutral-400 font-sans italic block">
                              Belum upload bukti
                            </span>
                          ) : null}

                          {effectivePaymentStatus !== "paid" && effectivePaymentMethod === "qris" && (
                            <button
                              onClick={() => handleTogglePaymentStatus(int)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-md transition-all shadow-xs"
                              title="Konfirmasi Pembayaran QRIS"
                            >
                              ✓ Verifikasi QRIS
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-sans text-center">
                        {int.tracking_number ? (
                          <button
                            onClick={() => handleOpenResiModal(int)}
                            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold inline-flex items-center gap-1.5 transition-all"
                            title="Klik untuk mengubah nomor resi"
                          >
                            <Truck className="w-3 h-3 text-blue-600" />
                            {int.tracking_number}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenResiModal(int)}
                            className="bg-neutral-100 hover:bg-black hover:text-white text-neutral-600 border border-neutral-200 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer inline-block"
                          >
                            + Input Resi
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-6 text-neutral-700 font-sans">
                        {items.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5 mb-2">
                            {items.map((item: CartItemMeta, idx: number) => (
                              <li key={idx}>
                                {item.productName || item.product_name || "Produk"} ({item.sizeMl || item.size_ml || 50}ml) - {item.quantity || 1}x
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-neutral-400 italic">No items</span>
                        )}
                        {parsedMeta && typeof parsedMeta.courier_name === "string" && (
                          <div className="text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-600 px-2 py-0.5 rounded inline-flex items-center gap-1 mt-1 font-mono font-bold">
                            <Truck className="w-3 h-3" />
                            {parsedMeta.courier_name}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-bold text-black font-sans text-right">
                        {formatRupiah(effectiveTotalPrice)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setDeleteIntentTargetIds([int.id.toString()]);
                            setIsDeleteIntentModalOpen(true);
                          }}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
                          title="Hapus Pesanan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalIntentsCount > intentsLimit && (
            <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-4 flex items-center justify-between font-sans">
              <span className="text-xs text-neutral-500">
                Menampilkan {(intentsPage - 1) * intentsLimit + 1} - {Math.min(intentsPage * intentsLimit, totalIntentsCount)} dari {totalIntentsCount} pesanan
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIntentsPage(Math.max(1, intentsPage - 1))}
                  disabled={intentsPage === 1}
                  className="p-1.5 rounded bg-white border border-neutral-200 text-neutral-600 disabled:opacity-50 hover:bg-neutral-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIntentsPage(intentsPage + 1)}
                  disabled={intentsPage * intentsLimit >= totalIntentsCount}
                  className="p-1.5 rounded bg-white border border-neutral-200 text-neutral-600 disabled:opacity-50 hover:bg-neutral-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW PAYMENT PROOF MODAL */}
      {viewingProofIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-neutral-900 font-plus-jakarta">Bukti Transfer QRIS</h3>
                <p className="text-xs text-neutral-500">{viewingProofIntent.customer_name || "Customer"} - {formatRupiah(viewingProofIntent.total_price || viewingProofIntent.price || 0)}</p>
              </div>
              <button onClick={() => setViewingProofIntent(null)} className="text-neutral-400 hover:text-black p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full h-80 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={(() => {
                  let url = "";
                  try {
                    const parsed = JSON.parse(viewingProofIntent.items_json || "");
                    url = parsed.payment_proof_url;
                  } catch {
                    const urlMatch = viewingProofIntent.items_json?.match(/https?:\/\/[^\s"'\\]+/i) || viewingProofIntent.items_json?.match(/data:image\/[a-zA-Z]+;base64,[^\s"'\\]+/i);
                    if (urlMatch) url = urlMatch[0];
                  }
                  return url || viewingProofIntent.payment_proof_url || "";
                })()} 
                alt="Bukti Pembayaran QRIS" 
                className="w-full h-full object-contain" 
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={() => {
                    handleTogglePaymentStatus(viewingProofIntent);
                    setViewingProofIntent(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    viewingProofIntent.payment_status === "paid" || 
                    (typeof window !== "undefined" && localStorage.getItem(`alparfume_intent_status_${viewingProofIntent.id}`) === "paid") ||
                    (() => { try { return JSON.parse(viewingProofIntent.items_json || "").payment_status === "paid"; } catch { return false; } })()
                      ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {viewingProofIntent.payment_status === "paid" || 
                   (typeof window !== "undefined" && localStorage.getItem(`alparfume_intent_status_${viewingProofIntent.id}`) === "paid") ||
                   (() => { try { return JSON.parse(viewingProofIntent.items_json || "").payment_status === "paid"; } catch { return false; } })()
                    ? "Batalkan Verifikasi"
                    : "✓ Konfirmasi Verifikasi QRIS"}
                </button>
                <button
                  onClick={() => setViewingProofIntent(null)}
                  className="px-5 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full"
                >
                  Tutup
                </button>
              </div>

              <button
                onClick={() => handleDeleteProof(viewingProofIntent)}
                disabled={deletingProof}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingProof ? "Menghapus dari Storage..." : "Hapus Bukti (Hemat Storage Supabase)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteIntentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-plus-jakarta text-neutral-900">Konfirmasi Hapus</h3>
              <p className="text-sm text-neutral-500 font-sans">
                Apakah Anda yakin ingin menghapus {deleteIntentTargetIds.length} pesanan ini? Data yang dihapus tidak dapat dikembalikan.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setIsDeleteIntentModalOpen(false);
                  setDeleteIntentTargetIds([]);
                }}
                className="px-6 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
                disabled={deletingIntent}
              >
                Batal
              </button>
              <button
                onClick={handleDeleteIntents}
                disabled={deletingIntent}
                className="px-6 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingIntent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Resi Modal */}
      {isResiModalOpen && selectedIntentForResi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">Input Nomor Resi</h3>
              <button onClick={() => setIsResiModalOpen(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveResi} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Nama Pelanggan
                </label>
                <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-600">
                  {selectedIntentForResi.customer_name}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Nomor Resi / Pelacakan
                </label>
                <input
                  type="text"
                  value={resiInput}
                  onChange={(e) => setResiInput(e.target.value)}
                  placeholder="Masukkan nomor resi..."
                  className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm transition-shadow font-mono"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsResiModalOpen(false)}
                  className="px-6 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
                  disabled={savingResi}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingResi}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-black hover:bg-neutral-800 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {savingResi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Resi"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
