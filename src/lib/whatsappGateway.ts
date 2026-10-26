/**
 * WhatsApp Gateway Integration for Al Parfume
 * Powered by Fonnte API (https://fonnte.com)
 */

import { formatRupiah } from "./whatsapp";

/**
 * Format phone number to Indonesian international standard format (628xxx)
 */
export function formatWaForFonnte(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

export interface OrderItemSummary {
  productName: string;
  sizeMl?: number;
  quantity: number;
  price?: number;
  totalItemPrice?: number;
}

export interface OrderConfirmationData {
  customerName: string;
  orderCode: string;
  items: OrderItemSummary[];
  grandTotal: number;
  subtotal?: number;
  shippingCost?: number;
  paymentMethod?: string;
  deliveryMethod?: string;
  customerAddress?: string | null;
  originUrl?: string;
}

/**
 * Builds the official luxury Al Parfume order confirmation message
 */
export function buildOrderConfirmationMessage(data: OrderConfirmationData): string {
  const customerName = data.customerName?.trim() || "Kak";
  const orderCode = data.orderCode;
  const baseUrl = data.originUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://alparfume.com";
  const trackingUrl = `${baseUrl.replace(/\/$/, "")}/orders/${orderCode}`;

  // Format ordered items list
  let itemsFormatted = "";
  if (data.items && data.items.length > 0) {
    itemsFormatted = data.items
      .map((item, idx) => {
        const sizeStr = item.sizeMl ? ` (${item.sizeMl}ml)` : "";
        const qtyStr = `x${item.quantity || 1}`;
        const itemPrice = item.totalItemPrice || (item.price ? item.price * (item.quantity || 1) : 0);
        const priceStr = itemPrice > 0 ? ` - ${formatRupiah(itemPrice)}` : "";
        return `${idx + 1}. *${item.productName}*${sizeStr} ${qtyStr}${priceStr}`;
      })
      .join("\n");
  } else {
    itemsFormatted = "• 1x Pesanan Parfum Eksklusif";
  }

  // Delivery Method description
  const isPickup = data.deliveryMethod === "pickup" || 
    (data.customerAddress && data.customerAddress.toLowerCase().includes("ambil di toko"));
  const deliveryFormatted = isPickup
    ? "🏬 *Metode Pengiriman:* Ambil di Toko (AL Parfume Madiun)"
    : `🚚 *Metode Pengiriman:* Kurir Pengiriman / Kirim Alamat${data.customerAddress ? `\n📍 *Alamat:* ${data.customerAddress}` : ""}`;

  // Payment Method description
  const paymentMethodLower = (data.paymentMethod || "").toLowerCase();
  const isCod = paymentMethodLower === "cod" || paymentMethodLower === "cod_pickup";
  const paymentFormatted = isCod
    ? "💵 *Metode Pembayaran:* COD / Bayar di Tempat"
    : "💳 *Metode Pembayaran:* QRIS / Transfer Bank";

  return `Halo Kak ${customerName}, terima kasih telah berbelanja di *AL Parfume*! ✨

Pesanan Anda telah berhasil dibuat dengan rincian berikut:
🆔 *No. Pesanan:* #${orderCode}

🛍️ *Detail Produk Dipesan:*
${itemsFormatted}

💰 *Total Pembayaran:* *${formatRupiah(data.grandTotal)}*
${paymentFormatted}
${deliveryFormatted}

🔗 *Cek Status Live & Instruksi Pembayaran:*
${trackingUrl}

${!isCod ? "💡 *Catatan:* Silakan buka link di atas untuk scan kode QRIS dan mengunggah bukti pembayaran Anda.\n\n" : ""}Mohon konfirmasinya ya Kak jika data pesanan di atas sudah sesuai. Terima kasih banyak! 🙏`;
}

export interface FonnteSendResult {
  success: boolean;
  statusText: string;
  error?: string;
  data?: unknown;
}

/**
 * Send WhatsApp message using Fonnte API
 * Defensive & Non-blocking: Handles network errors, timeouts, and missing tokens gracefully
 */
export async function sendFonnteMessage(
  targetPhone: string,
  message: string
): Promise<FonnteSendResult> {
  const token = process.env.FONNTE_API_TOKEN?.trim();

  if (!token) {
    console.warn("[Fonnte] FONNTE_API_TOKEN belum diset di environment. Pengiriman WA otomatis dilewati.");
    return {
      success: false,
      statusText: "unconfigured",
      error: "FONNTE_API_TOKEN is not configured in environment variables",
    };
  }

  const formattedTarget = formatWaForFonnte(targetPhone);
  if (!formattedTarget || formattedTarget.length < 8) {
    return {
      success: false,
      statusText: "invalid_phone",
      error: `Nomor WhatsApp tidak valid: "${targetPhone}"`,
    };
  }

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: formattedTarget,
        message: message,
        countryCode: "62",
      }),
      signal: AbortSignal.timeout(7000), // 7-second defensive timeout
    });

    const result = await response.json().catch(() => null);

    if (response.ok && result && (result.status === true || result.status === "true")) {
      return {
        success: true,
        statusText: "sent",
        data: result,
      };
    }

    const errReason = result?.reason || result?.message || response.statusText || "Gagal mengirim via Fonnte";
    console.warn(`[Fonnte] Gagal mengirim pesan ke ${formattedTarget}:`, errReason);
    return {
      success: false,
      statusText: "failed",
      error: errReason,
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network/timeout error";
    console.error(`[Fonnte] Error exception saat kirim WA ke ${formattedTarget}:`, errorMsg);
    return {
      success: false,
      statusText: "network_error",
      error: errorMsg,
    };
  }
}
