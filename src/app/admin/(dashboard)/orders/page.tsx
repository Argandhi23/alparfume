"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, OrderIntent } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { 
  Trash2, Loader2, X, Image as ImageIcon, Truck, ChevronLeft, ChevronRight, Download,
  CheckCircle2, Clock, Store, Search, Filter, MessageCircle, RefreshCw
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
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "cod">("all");

  // Pagination
  const [intentsPage, setIntentsPage] = useState(1);
  const intentsLimit = 15;
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

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchIntents = useCallback(async (page: number = 1, silent: boolean = false) => {
    if (!silent) setLoadingData(true);
    try {
      let fetchedSuccessfully = false;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(`/api/admin/intents?page=${page}&limit=${intentsLimit}&_t=${Date.now()}`, {
          cache: "no-store",
          headers,
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

  const handleDeleteProof = async (intent: OrderIntent) => {
    if (!confirm(`Hapus foto bukti pembayaran untuk pesanan ${intent.customer_name || ""}? Ini akan membebaskan ruang di Supabase Storage.`)) return;
    
    setDeletingProof(true);
    try {
      let isSuccess = false;

      // Primary API call to delete from storage & update DB with Authorization token
      try {
        const authHeader = await getAuthHeader();
        const res = await fetch("/api/admin/intents/delete-proof", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({ orderId: intent.id }),
        });
        if (res.ok) {
          isSuccess = true;
        }
      } catch (e) {
        console.warn("API delete-proof failed, using direct client fallback:", e);
      }

      // Direct client-side Supabase update fallback if API call had issues
      if (!isSuccess) {
        const { error: dbErr } = await supabase
          .from("order_intents")
          .update({ payment_proof_url: null })
          .eq("id", intent.id);

        if (!dbErr) {
          isSuccess = true;
        }
      }

      if (isSuccess) {
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
        alert("Bukti pembayaran berhasil dihapus!");
        fetchIntents(intentsPage, true);
      } else {
        alert("Gagal menghapus bukti pembayaran dari database.");
      }
    } catch (err) {
      console.error("Gagal hapus bukti:", err);
      alert("Terjadi kesalahan saat menghapus bukti pembayaran.");
    } finally {
      setDeletingProof(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const authHeader = await getAuthHeader();

      let allIntents: OrderIntent[] = [];

      try {
        const response = await fetch(`/api/admin/intents?limit=all&_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
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
                .map((item) => {
                  const name = item.productName || item.product_name || "Produk";
                  const info = formatSizeMlLabel(item.sizeMl || item.size_ml || order.size_ml, name);
                  return `- ${name} [${info.label}] (Qty: ${item.quantity || 1})`;
                })
                .join("<br>");
            }
          } catch {
            const name = order.product_name || "Produk";
            const info = formatSizeMlLabel(order.size_ml, name);
            productDetails = `${name} [${info.label}]`;
          }
        } else {
          const name = order.product_name || "Produk";
          const info = formatSizeMlLabel(order.size_ml, name);
          productDetails = `${name} [${info.label}]`;
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
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">Rp ${orderPrice.toLocaleString("id-ID")}</td>
          </tr>
        `;
      });

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Laporan Pesanan</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .header-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 5px; }
            .header-subtitle { font-size: 11px; color: #555; text-align: center; margin-bottom: 15px; }
            th { background-color: #000000; color: #ffffff; border: 1px solid #000000; padding: 10px; text-transform: uppercase; font-size: 11px; }
            .total-row { background-color: #f3f4f6; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-title">${title}</div>
          <div class="header-subtitle">Dicetak pada: ${printDate} | Total ${allIntents.length} Transaksi</div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Waktu Transaksi</th>
                <th>Nama Pelanggan</th>
                <th>No. WhatsApp</th>
                <th>Alamat Lengkap</th>
                <th>Rincian Produk Dipesan</th>
                <th>Nomor Resi</th>
                <th>Total Bayar</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="7" style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold;">TOTAL PENDAPATAN:</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold; color: #059669;">Rp ${totalRevenue.toLocaleString("id-ID")}</td>
              </tr>
            </tfoot>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Pesanan_AlParfume_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal ekspor excel:", err);
      alert("Terjadi kesalahan saat mengekspor laporan.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleOpenResiModal = (intent: OrderIntent) => {
    setSelectedIntentForResi(intent);
    setResiInput(intent.tracking_number || "");
    setIsResiModalOpen(true);
  };

  const formatWaForUrl = (phone?: string | null): string => {
    if (!phone) return "";
    let cleaned = phone.replace(/[^\d]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    }
    return cleaned;
  };

  const formatSizeMlLabel = (sizeMl?: number, productName?: string): { label: string; tagClass: string } => {
    const nameLower = (productName || "").toLowerCase();
    const isSample = nameLower.includes("sample") || (sizeMl !== undefined && sizeMl > 0 && sizeMl <= 15);
    
    if (isSample) {
      if (nameLower.includes("all variant") || nameLower.includes("semua varian")) {
        return { label: "Sample All Variant (10ml)", tagClass: "bg-purple-100 text-purple-800 border-purple-200" };
      }
      if (nameLower.includes("3 variant") || nameLower.includes("3 varian")) {
        return { label: "Sample 3 Variant (10ml)", tagClass: "bg-purple-100 text-purple-800 border-purple-200" };
      }
      return { label: "Sample (10ml)", tagClass: "bg-purple-100 text-purple-800 border-purple-200" };
    }

    if (sizeMl === 30 || sizeMl === 35) {
      return { label: "30ml", tagClass: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (sizeMl === 50) {
      return { label: "50ml", tagClass: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (sizeMl === 100) {
      return { label: "100ml", tagClass: "bg-amber-50 text-amber-800 border-amber-200" };
    }

    return { label: sizeMl ? `${sizeMl}ml` : "30ml", tagClass: "bg-neutral-100 text-neutral-700 border-neutral-200" };
  };

  const buildCustomerWaConfirmationMessage = (intent: OrderIntent): string => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://alparfume.com";
    const trackingUrl = `${origin}/orders/${intent.order_code || intent.id}`;
    const orderCode = intent.order_code || (intent.id ? String(intent.id).substring(0, 8).toUpperCase() : "PESANAN");
    const customerName = intent.customer_name || "Pelanggan";

    let itemLines: string[] = [];
    if (intent.items_json) {
      try {
        const parsed = typeof intent.items_json === "string" ? JSON.parse(intent.items_json) : intent.items_json;
        let itemsArray: CartItemMeta[] = [];
        if (Array.isArray(parsed)) {
          itemsArray = parsed;
        } else if (parsed.cartItems && Array.isArray(parsed.cartItems)) {
          itemsArray = parsed.cartItems;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          itemsArray = parsed.items;
        }

        if (itemsArray.length > 0) {
          itemLines = itemsArray.map((itm) => {
            const name = itm.productName || itm.product_name || "Parfum AL Parfume";
            const info = formatSizeMlLabel(itm.sizeMl || itm.size_ml || intent.size_ml, name);
            const qty = itm.quantity || 1;
            return `• *${name}* [${info.label}] x${qty}`;
          });
        }
      } catch {}
    }

    if (itemLines.length === 0) {
      const name = intent.product_name || "Parfum AL Parfume";
      const info = formatSizeMlLabel(intent.size_ml, name);
      itemLines = [`• *${name}* [${info.label}]`];
    }

    const itemsFormatted = itemLines.join("\n");

    const addressLower = (intent.customer_address || "").toLowerCase();
    const isPickupInStore =
      addressLower.includes("toko") ||
      addressLower.includes("ambil") ||
      addressLower.includes("madiun") ||
      !intent.customer_address;

    const deliveryFormatted = isPickupInStore
      ? "🏬 *Metode Pengiriman:* Ambil di Toko (AL Parfume Madiun)"
      : `🚚 *Metode Pengiriman:* Kurir Pengiriman / Kirim Alamat\n📍 *Alamat Tujuan:* ${intent.customer_address}`;

    const paymentStatus = (intent.payment_status || "").toLowerCase();
    const isPaid = paymentStatus === "paid" || !!intent.payment_proof_url;
    const paymentFormatted = isPaid
      ? "💳 *Status Pembayaran:* QRIS / Transfer (*LUNAS* ✅)"
      : `💵 *Status Pembayaran:* COD / Bayar di Tempat (Total: *${formatRupiah(intent.total_price || intent.price || 0)}*)`;

    const trackingNote = intent.tracking_number
      ? `\n📦 *No. Resi:* ${intent.tracking_number}`
      : "";

    return `Halo Kak ${customerName}, terima kasih telah berbelanja di *AL Parfume*! ✨

Berikut detail konfirmasi pesanan Anda:
🆔 *No. Pesanan:* #${orderCode}

🛍️ *Detail Produk Dipesan:*
${itemsFormatted}

💰 *Total Pembayaran:* ${formatRupiah(intent.total_price || intent.price || 0)}
${paymentFormatted}
${deliveryFormatted}${trackingNote}

🔗 *Status Live & Bukti Pesanan:*
${trackingUrl}

Mohon konfirmasinya ya Kak jika data pesanan di atas sudah sesuai. Terima kasih banyak! 🙏`;
  };

  const handleSendWaResi = (intent: OrderIntent) => {
    if (!intent.tracking_number || !intent.customer_wa) return;
    const waNumber = formatWaForUrl(intent.customer_wa);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://alparfume.com";
    const trackingUrl = `${origin}/orders/${intent.order_code || intent.id}`;
    const message = `Halo Kak ${intent.customer_name || ""}, pesanan Anda #${intent.order_code || intent.id} di Al Parfume telah dikirim! 🚀\n\nNo. Resi Pengiriman: *${intent.tracking_number}*\n\nAnda dapat mengecek status & tracking live pesanan Anda di link berikut:\n${trackingUrl}\n\nTerima kasih telah berbelanja di Al Parfume! ✨`;
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleSaveResi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntentForResi) return;

    setSavingResi(true);
    try {
      const cleanResi = resiInput.trim();
      const authHeader = await getAuthHeader();

      // Build merged items_json payload to guarantee persistence across schema variations
      let currentMeta: Record<string, unknown> = {};
      if (selectedIntentForResi.items_json) {
        try {
          const parsed = typeof selectedIntentForResi.items_json === "string" ? JSON.parse(selectedIntentForResi.items_json) : selectedIntentForResi.items_json;
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            currentMeta = parsed as Record<string, unknown>;
          }
        } catch {}
      }
      currentMeta.tracking_number = cleanResi || null;
      currentMeta.trackingNumber = cleanResi || null;
      currentMeta.fulfillment_status = cleanResi ? "shipped" : "pending";
      currentMeta.fulfillmentStatus = cleanResi ? "shipped" : "pending";

      const updatedItemsJson = JSON.stringify(currentMeta);

      const res = await fetch("/api/admin/intents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          id: selectedIntentForResi.id,
          updates: { 
            tracking_number: cleanResi || null,
            fulfillment_status: cleanResi ? "shipped" : "pending",
            items_json: updatedItemsJson,
          },
        }),
      });

      if (!res.ok) {
        // Client fallback
        await supabase
          .from("order_intents")
          .update({ 
            tracking_number: cleanResi || null,
            fulfillment_status: cleanResi ? "shipped" : "pending",
            items_json: updatedItemsJson,
          })
          .eq("id", selectedIntentForResi.id);
      }

      setIntents((prev) =>
        prev.map((item) =>
          item.id === selectedIntentForResi.id
            ? { 
                ...item, 
                tracking_number: cleanResi || null,
                fulfillment_status: cleanResi ? "shipped" : "pending",
                items_json: updatedItemsJson,
              }
            : item
        )
      );

      setIsResiModalOpen(false);

      if (cleanResi && selectedIntentForResi.customer_wa) {
        handleSendWaResi({
          ...selectedIntentForResi,
          tracking_number: cleanResi,
        });
      }

      setSelectedIntentForResi(null);
      setResiInput("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan nomor resi";
      alert(msg);
    } finally {
      setSavingResi(false);
    }
  };

  const handleSetReadyForPickup = async (intent: OrderIntent) => {
    try {
      const authHeader = await getAuthHeader();
      let currentMeta: Record<string, unknown> = {};
      if (intent.items_json) {
        try {
          const parsed = typeof intent.items_json === "string" ? JSON.parse(intent.items_json) : intent.items_json;
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            currentMeta = parsed as Record<string, unknown>;
          }
        } catch {}
      }
      currentMeta.fulfillment_status = "ready_for_pickup";
      currentMeta.fulfillmentStatus = "ready_for_pickup";
      const updatedItemsJson = JSON.stringify(currentMeta);

      const res = await fetch("/api/admin/intents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          id: intent.id,
          updates: {
            fulfillment_status: "ready_for_pickup",
            items_json: updatedItemsJson,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Gagal mengubah status pesanan.");
        return;
      }

      setIntents((prev) =>
        prev.map((item) =>
          item.id === intent.id
            ? { ...item, fulfillment_status: "ready_for_pickup", items_json: updatedItemsJson }
            : item
        )
      );
      fetchIntents(intentsPage, true);
    } catch (err) {
      console.error("Gagal mengubah status siap diambil di toko:", err);
    }
  };

  const handleConfirmPaymentStatus = async (intent: OrderIntent) => {
    if (!confirm(`Konfirmasi pembayaran lunas untuk pesanan ${intent.customer_name || ""}?`)) return;

    try {
      // Build merged items_json payload
      let currentMeta: Record<string, unknown> = {};
      if (intent.items_json) {
        try {
          const parsed = typeof intent.items_json === "string" ? JSON.parse(intent.items_json) : intent.items_json;
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            currentMeta = parsed as Record<string, unknown>;
          }
        } catch {}
      }
      currentMeta.payment_status = "paid";
      currentMeta.paymentStatus = "paid";
      currentMeta.fulfillment_status = "packing";
      currentMeta.fulfillmentStatus = "packing";

      const updatedItemsJson = JSON.stringify(currentMeta);

      const authHeader = await getAuthHeader();
      const res = await fetch("/api/admin/intents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          id: intent.id,
          updates: { 
            payment_status: "paid",
            fulfillment_status: "packing",
            items_json: updatedItemsJson,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Gagal mengonfirmasi pembayaran. Silakan periksa kembali ketersediaan stok.");
        return;
      }

      setIntents((prev) =>
        prev.map((item) =>
          item.id === intent.id
            ? { 
                ...item, 
                payment_status: "paid",
                fulfillment_status: "packing",
                items_json: updatedItemsJson,
              }
            : item
        )
      );
      fetchIntents(intentsPage, true);
    } catch (err) {
      console.error("Gagal konfirmasi lunas:", err);
      alert("Terjadi kesalahan saat mengonfirmasi lunas.");
    }
  };

  const handleCompleteOrder = async (intent: OrderIntent) => {
    if (
      !confirm(
        `Selesaikan pesanan #${intent.order_code || intent.id}? ${
          intent.payment_proof_url
            ? "Ini akan menandai pesanan selesai dan otomatis menghapus foto bukti pembayaran dari storage."
            : "Ini akan menandai pesanan selesai."
        }`
      )
    )
      return;

    try {
      const authHeader = await getAuthHeader();

      let currentMeta: Record<string, unknown> = {};
      if (intent.items_json) {
        try {
          const parsed =
            typeof intent.items_json === "string"
              ? JSON.parse(intent.items_json)
              : intent.items_json;
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            currentMeta = parsed as Record<string, unknown>;
          }
        } catch {}
      }

      currentMeta.fulfillment_status = "completed";
      currentMeta.fulfillmentStatus = "completed";
      currentMeta.payment_status = "paid";
      currentMeta.paymentStatus = "paid";
      currentMeta.payment_proof_url = null;
      currentMeta.paymentProofUrl = null;

      const updatedItemsJson = JSON.stringify(currentMeta);

      // 1. Update DB fulfillment status & payment status
      const res = await fetch("/api/admin/intents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          id: intent.id,
          updates: {
            fulfillment_status: "completed",
            payment_status: "paid",
            payment_proof_url: null,
            items_json: updatedItemsJson,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Gagal menyelesaikan pesanan. Silakan periksa kembali ketersediaan stok.");
        return;
      }

      // 2. If proof image exists in storage, delete it from storage bucket
      if (intent.payment_proof_url) {
        try {
          await fetch("/api/admin/intents/delete-proof", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader,
            },
            body: JSON.stringify({ orderId: intent.id }),
          });
        } catch (err) {
          console.warn("Notice deleting proof image on complete:", err);
        }
      }

      // 3. Update local state
      setIntents((prev) =>
        prev.map((item) =>
          item.id === intent.id
            ? {
                ...item,
                fulfillment_status: "completed",
                payment_status: "paid",
                payment_proof_url: null,
                items_json: updatedItemsJson,
              }
            : item
        )
      );

      if (viewingProofIntent?.id === intent.id) {
        setViewingProofIntent(null);
      }

      fetchIntents(intentsPage, true);
    } catch (err) {
      console.error("Gagal menyelesaikan pesanan:", err);
      alert("Terjadi kesalahan saat menyelesaikan pesanan.");
    }
  };

  const handleExecuteMultiDelete = async () => {
    if (deleteIntentTargetIds.length === 0) return;
    setDeletingIntent(true);
    try {
      const authHeader = await getAuthHeader();

      const res = await fetch("/api/admin/intents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ ids: deleteIntentTargetIds }),
      });

      if (!res.ok) {
        const numericIds = deleteIntentTargetIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
        const stringIds = deleteIntentTargetIds.filter((id) => isNaN(parseInt(id, 10)));

        if (numericIds.length > 0) {
          await supabase.from("order_intents").delete().in("id", numericIds);
        }
        if (stringIds.length > 0) {
          await supabase.from("order_intents").delete().in("id", stringIds);
        }
      }

      setIsDeleteIntentModalOpen(false);
      setSelectedIntentIds([]);
      setDeleteIntentTargetIds([]);
      fetchIntents(intentsPage);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pesanan";
      alert(msg);
    } finally {
      setDeletingIntent(false);
    }
  };

  const handleSingleDelete = async (intent: OrderIntent) => {
    if (!confirm(`Hapus transaksi ${intent.customer_name || ""}?`)) return;
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/admin/intents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ ids: [intent.id] }),
      });

      if (!res.ok) {
        await supabase.from("order_intents").delete().eq("id", intent.id);
      }
      fetchIntents(intentsPage);
    } catch (err) {
      console.error("Gagal menghapus pesanan:", err);
    }
  };

  // Filtered Intents List
  const filteredIntents = useMemo(() => {
    return intents.filter((int) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (int.customer_name || "").toLowerCase().includes(q);
        const waMatch = (int.customer_wa || "").toLowerCase().includes(q);
        const resiMatch = (int.tracking_number || "").toLowerCase().includes(q);
        const codeMatch = (int.order_code || "").toLowerCase().includes(q);
        const prodMatch = (int.product_name || int.items_json || "").toLowerCase().includes(q);
        if (!nameMatch && !waMatch && !resiMatch && !codeMatch && !prodMatch) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === "paid") {
        return int.payment_status === "paid";
      }
      if (statusFilter === "pending") {
        const isPickupOrder =
          int.payment_method === "cod_pickup" ||
          int.courier_name === "Ambil di Toko" ||
          (int.customer_address && int.customer_address.includes("AMBIL DI TOKO")) ||
          (int.items_json &&
            (int.items_json.includes('"payment_method":"cod_pickup"') ||
              int.items_json.includes('"delivery_method":"pickup"') ||
              int.items_json.includes('"Ambil di Toko"')));

        return int.payment_status !== "paid" && !isPickupOrder;
      }
      if (statusFilter === "cod") {
        const isPickupOrder =
          int.payment_method === "cod_pickup" ||
          int.courier_name === "Ambil di Toko" ||
          (int.customer_address && int.customer_address.includes("AMBIL DI TOKO")) ||
          (int.items_json &&
            (int.items_json.includes('"payment_method":"cod_pickup"') ||
              int.items_json.includes('"delivery_method":"pickup"') ||
              int.items_json.includes('"Ambil di Toko"')));

        return isPickupOrder;
      }

      return true;
    });
  }, [intents, searchQuery, statusFilter]);

  const totalPages = Math.ceil(totalIntentsCount / intentsLimit) || 1;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-plus-jakarta text-neutral-900">
              Daftar Pesanan
            </h1>
            <span className="bg-neutral-100 text-neutral-700 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
              {totalIntentsCount}
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Kelola transaksi masuk, konfirmasi bukti pembayaran QRIS, dan input resi pengiriman.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchIntents(intentsPage)}
            className="p-2.5 rounded-2xl border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all font-sans disabled:opacity-50"
          >
            {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Ekspor Excel
          </button>

          {selectedIntentIds.length > 0 && (
            <button
              onClick={() => {
                setDeleteIntentTargetIds(selectedIntentIds);
                setIsDeleteIntentModalOpen(true);
              }}
              className="bg-rose-500 text-white hover:bg-rose-600 px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Hapus ({selectedIntentIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-black text-white shadow-xs"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "pending"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Perlu Verifikasi
          </button>
          <button
            onClick={() => setStatusFilter("paid")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "paid"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Lunas
          </button>
          <button
            onClick={() => setStatusFilter("cod")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === "cod"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Ambil Toko (COD)
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, WA, resi..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      {loadingData ? (
        <div className="flex flex-col items-center justify-center py-20 border border-neutral-200/80 rounded-3xl bg-white shadow-xs space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
          <span className="text-xs text-neutral-400 font-medium">Memuat data pesanan...</span>
        </div>
      ) : filteredIntents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-300 rounded-3xl bg-white space-y-2">
          <Filter className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-xs tracking-widest text-neutral-400 uppercase font-bold">
            {searchQuery || statusFilter !== "all" ? "Tidak ada pesanan yang sesuai filter" : "Belum ada pesanan masuk"}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
              className="text-xs text-black font-bold hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="border border-neutral-200/80 bg-white rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/80 text-neutral-400 uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer"
                      checked={selectedIntentIds.length === filteredIntents.length && filteredIntents.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIntentIds(filteredIntents.map((i) => i.id.toString()));
                        } else {
                          setSelectedIntentIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="py-3.5 px-4 min-w-[140px]">Waktu & Order ID</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Pelanggan</th>
                  <th className="py-3.5 px-4 min-w-[190px]">Rincian Produk</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Pembayaran</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Pengiriman / Resi</th>
                  <th className="py-3.5 px-4 w-28 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {filteredIntents.map((int) => {
                  let items: CartItemMeta[] = [];
                  let parsedMeta: Record<string, unknown> = {};
                  const itemsJsonString = int.items_json || "";
                  
                  if (itemsJsonString) {
                    try {
                      const parsed = JSON.parse(itemsJsonString);
                      if (Array.isArray(parsed)) {
                        items = parsed;
                      } else if (typeof parsed === "object" && parsed !== null) {
                        parsedMeta = parsed as Record<string, unknown>;
                        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                          items = parsed.items as CartItemMeta[];
                        } else if (Array.isArray(parsed.cartItems) && parsed.cartItems.length > 0) {
                          items = parsed.cartItems as CartItemMeta[];
                        }
                      }
                    } catch {
                      items = [];
                    }
                  }

                  const effectivePaymentMethod = parsedMeta.paymentMethod || int.payment_method;
                  
                  const isPickup =
                    effectivePaymentMethod === "cod_pickup" ||
                    int.payment_method === "cod_pickup" ||
                    int.courier_name === "Ambil di Toko" ||
                    (int.customer_address && int.customer_address.includes("AMBIL DI TOKO")) ||
                    (itemsJsonString &&
                      (itemsJsonString.includes('"payment_method":"cod_pickup"') ||
                        itemsJsonString.includes('"delivery_method":"pickup"') ||
                        itemsJsonString.includes('"Ambil di Toko"')));

                  let effectivePaymentStatus = int.payment_status || "pending_verification";
                  if (int.payment_status === "paid" || (parsedMeta && !Array.isArray(parsedMeta) && parsedMeta.payment_status === "paid")) {
                    effectivePaymentStatus = "paid";
                  } else if (parsedMeta && !Array.isArray(parsedMeta) && typeof parsedMeta.payment_status === "string") {
                    effectivePaymentStatus = parsedMeta.payment_status as string;
                  }

                  let effectiveProofUrl = int.payment_proof_url;
                  if (parsedMeta && !Array.isArray(parsedMeta) && typeof parsedMeta.payment_proof_url === "string") {
                    effectiveProofUrl = parsedMeta.payment_proof_url;
                  }

                  const effectiveFulfillmentStatus =
                    int.fulfillment_status ||
                    (parsedMeta && !Array.isArray(parsedMeta) ? (parsedMeta.fulfillment_status || parsedMeta.fulfillmentStatus) : null) ||
                    "pending";
                  const effectiveTrackingNumber = int.tracking_number || (parsedMeta && !Array.isArray(parsedMeta) ? (parsedMeta.tracking_number || parsedMeta.trackingNumber || null) : null);
                  if (!effectiveProofUrl && itemsJsonString) {
                    const urlMatch = itemsJsonString.match(/https?:\/\/[^\s"'\\]+/i) || itemsJsonString.match(/data:image\/[a-zA-Z]+;base64,[^\s"'\\]+/i);
                    if (urlMatch) {
                      effectiveProofUrl = urlMatch[0];
                    }
                  }
                  const effectiveTotalPrice = int.total_price || (parsedMeta.grand_total as number) || int.price || 0;

                  return (
                    <tr key={int.id} className="hover:bg-neutral-50/60 transition-colors text-xs">
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center align-top">
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
                          className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer mt-0.5"
                        />
                      </td>

                      {/* Order Code & Waktu */}
                      <td className="py-4 px-4 align-top space-y-1">
                        <span className="font-mono font-bold text-neutral-900 text-xs block">
                          {int.order_code || `ORD-${int.id}`}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          {new Date(int.created_at).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="py-4 px-4 align-top space-y-1">
                        <div className="font-bold text-neutral-900 text-xs">{int.customer_name || "Pelanggan"}</div>
                        {int.customer_wa && (
                          <a
                            href={`https://api.whatsapp.com/send?phone=${formatWaForUrl(int.customer_wa)}&text=${encodeURIComponent(
                              buildCustomerWaConfirmationMessage(int)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                            title="Klik untuk kirim pesan konfirmasi pesanan ke WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Chat WA ({int.customer_wa})</span>
                          </a>
                        )}
                        {int.customer_address && (
                          <p className="text-[10px] text-neutral-500 line-clamp-2 max-w-[200px]" title={int.customer_address}>
                            📍 {int.customer_address}
                          </p>
                        )}
                      </td>

                      {/* Item Dipesan & Total */}
                      <td className="py-4 px-4 align-top space-y-1.5 min-w-[260px]">
                        <div className="space-y-1.5">
                          {items.length > 0 ? (
                            items.map((itm, idx) => {
                              const name = itm.productName || itm.product_name || "Parfum AL Parfume";
                              const sizeInfo = formatSizeMlLabel(itm.sizeMl || itm.size_ml || int.size_ml, name);
                              return (
                                <div key={idx} className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/90 space-y-1 shadow-2xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-extrabold text-neutral-900 text-xs uppercase tracking-tight font-plus-jakarta">{name}</span>
                                    <span className="text-neutral-700 font-mono font-bold text-xs bg-white px-2 py-0.5 rounded-md border border-neutral-200 shadow-2xs">x{itm.quantity || 1}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sizeInfo.tagClass}`}>
                                      {sizeInfo.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            (() => {
                              const name = int.product_name || "Parfum AL Parfume";
                              const sizeInfo = formatSizeMlLabel(int.size_ml, name);
                              return (
                                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/90 space-y-1 shadow-2xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-extrabold text-neutral-900 text-xs uppercase tracking-tight font-plus-jakarta">{name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sizeInfo.tagClass}`}>
                                      {sizeInfo.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                        {int.order_notes && (
                          <div className="text-[10px] bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-xl font-medium">
                            📝 <strong>Catatan Pembeli:</strong> {int.order_notes}
                          </div>
                        )}
                        <div className="font-extrabold text-sm text-black font-plus-jakarta pt-1 flex items-center justify-between">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Total Transaksi:</span>
                          <span>{formatRupiah(effectiveTotalPrice)}</span>
                        </div>
                      </td>

                      {/* Status Pembayaran */}
                      <td className="py-4 px-4 align-top space-y-2">
                        {effectivePaymentStatus === "paid" ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Terverifikasi Lunas
                          </span>
                        ) : isPickup ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            Ambil Toko (COD)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Perlu Verifikasi
                          </span>
                        )}

                        {/* Action Bukti Transfer */}
                        {effectiveProofUrl ? (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              onClick={() => setViewingProofIntent(int)}
                              className="text-[10px] bg-black hover:bg-neutral-800 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                            >
                              <ImageIcon className="w-3 h-3 text-amber-400" />
                              Bukti QRIS
                            </button>
                            <button
                              onClick={() => handleDeleteProof(int)}
                              className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 p-1 rounded-lg transition-all"
                              title="Hapus Bukti Transfer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null}
                      </td>

                      {/* Pengiriman / Resi */}
                      <td className="py-4 px-4 align-top space-y-1.5">
                        {isPickup ? (
                          effectiveFulfillmentStatus === "ready_for_pickup" || effectiveFulfillmentStatus === "siap" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                              <Store className="w-3.5 h-3.5 text-emerald-600" />
                              Siap Diambil di Toko
                            </span>
                          ) : effectiveFulfillmentStatus === "completed" || effectiveFulfillmentStatus === "selesai" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Diserahkan di Toko
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetReadyForPickup(int)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                              title="Tandai parfum siap diambil di toko Madiun"
                            >
                              <Store className="w-3.5 h-3.5" />
                              + Tandai Siap Diambil
                            </button>
                          )
                        ) : effectiveTrackingNumber ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono">
                              <Truck className="w-3 h-3 text-neutral-600" />
                              {String(effectiveTrackingNumber)}
                            </span>
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                onClick={() => handleOpenResiModal({ ...int, tracking_number: String(effectiveTrackingNumber) })}
                                className="text-[10px] text-neutral-500 hover:text-black font-semibold"
                              >
                                Edit Resi
                              </button>
                              <button
                                onClick={() => handleSendWaResi({ ...int, tracking_number: String(effectiveTrackingNumber) })}
                                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5"
                                title="Kirim Link Tracking via WA"
                              >
                                <MessageCircle className="w-3 h-3" />
                                Kirim WA
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenResiModal(int)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200/80 transition-all"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            + Input Resi
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {effectiveFulfillmentStatus === "completed" || effectiveFulfillmentStatus === "selesai" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Selesai
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCompleteOrder(int)}
                              className="inline-flex items-center gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg shadow-xs transition-all"
                              title={effectiveProofUrl ? "Selesaikan pesanan & hapus bukti transfer dari storage" : "Selesaikan pesanan"}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Selesaikan
                            </button>
                          )}
                          <button
                            onClick={() => handleSingleDelete(int)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors"
                            title="Hapus Pesanan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-neutral-100 bg-neutral-50/50 text-xs font-sans">
            <span className="text-neutral-500 font-medium">
              Menampilkan {filteredIntents.length} dari {totalIntentsCount} pesanan
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={intentsPage <= 1}
                onClick={() => setIntentsPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 disabled:opacity-40 font-bold flex items-center gap-1 shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </button>
              <span className="font-bold text-neutral-900 px-2 font-mono">
                {intentsPage} / {totalPages}
              </span>
              <button
                disabled={intentsPage >= totalPages}
                onClick={() => setIntentsPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 disabled:opacity-40 font-bold flex items-center gap-1 shadow-xs"
              >
                Berikutnya
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT RESI MODAL */}
      {isResiModalOpen && selectedIntentForResi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">
                  Input Nomor Resi
                </h3>
                <p className="text-xs text-neutral-500 font-mono">
                  Order #{selectedIntentForResi.order_code || selectedIntentForResi.id} - {selectedIntentForResi.customer_name}
                </p>
              </div>
              <button onClick={() => setIsResiModalOpen(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResi} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Nomor Resi Kurir
                </label>
                <input
                  type="text"
                  required
                  value={resiInput}
                  onChange={(e) => setResiInput(e.target.value)}
                  placeholder="Contoh: JNT123456789"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsResiModalOpen(false)}
                  className="px-5 py-2.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingResi}
                  className="px-5 py-2.5 font-bold text-white bg-black hover:bg-neutral-800 rounded-full flex items-center gap-2"
                >
                  {savingResi && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Resi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PROOF MODAL */}
      {viewingProofIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">
                  Bukti Pembayaran QRIS
                </h3>
                <p className="text-xs text-neutral-500">
                  Pelanggan: {viewingProofIntent.customer_name} ({viewingProofIntent.customer_wa})
                </p>
              </div>
              <button onClick={() => setViewingProofIntent(null)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proof Image View */}
            <div className="relative aspect-auto max-h-[420px] bg-neutral-950 rounded-2xl overflow-hidden flex items-center justify-center border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewingProofIntent.payment_proof_url || ""}
                alt="Bukti Transfer"
                className="max-h-[400px] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <button
                onClick={() => handleDeleteProof(viewingProofIntent)}
                disabled={deletingProof}
                className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-2"
              >
                {deletingProof ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Hapus Foto Bukti
              </button>

              <div className="flex items-center gap-2">
                {viewingProofIntent.payment_status !== "paid" && (
                  <button
                    onClick={() => {
                      handleConfirmPaymentStatus(viewingProofIntent);
                      setViewingProofIntent(null);
                    }}
                    className="px-4 py-2 bg-neutral-900 text-white hover:bg-black font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Konfirmasi Lunas
                  </button>
                )}
                <button
                  onClick={() => handleCompleteOrder(viewingProofIntent)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Selesaikan & Hapus Bukti
                </button>
                <button
                  onClick={() => setViewingProofIntent(null)}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-bold rounded-xl text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MULTI DELETE MODAL */}
      {isDeleteIntentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="space-y-2">
              <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">
                Konfirmasi Hapus Pesanan
              </h3>
              <p className="text-xs text-neutral-600">
                Apakah Anda yakin ingin menghapus <strong>{deleteIntentTargetIds.length} pesanan</strong> terpilih? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsDeleteIntentModalOpen(false)}
                className="px-5 py-2.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingIntent}
                onClick={handleExecuteMultiDelete}
                className="px-5 py-2.5 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full flex items-center gap-2 text-xs"
              >
                {deletingIntent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
