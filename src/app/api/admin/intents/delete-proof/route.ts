import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 });
    }

    const numericId = parseInt(orderId.toString(), 10);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Fetch current order
    const { data: order, error: fetchErr } = await serviceClient
      .from("order_intents")
      .select("*")
      .eq("id", numericId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    let proofUrlToDelete = order.payment_proof_url || "";
    let itemsJsonObj: Record<string, unknown> = {};

    if (order.items_json) {
      try {
        const parsed = JSON.parse(order.items_json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          itemsJsonObj = parsed;
          if (!proofUrlToDelete && parsed.payment_proof_url) {
            proofUrlToDelete = parsed.payment_proof_url;
          }
        }
      } catch {
        // ignore parse error
      }
    }

    // 2. Delete physical image file from Supabase Storage 'payment-proofs' bucket if applicable
    let fileDeletedFromStorage = false;
    if (proofUrlToDelete && typeof proofUrlToDelete === "string") {
      try {
        // Match filename from URL (e.g. proof_123_1781231.jpg)
        const match = proofUrlToDelete.match(/payment-proofs\/([^?#]+)/) || proofUrlToDelete.match(/(proof_[^?#]+)/);
        if (match && match[1]) {
          const fileName = match[1];
          const { error: deleteErr } = await serviceClient.storage
            .from("payment-proofs")
            .remove([fileName]);

          if (!deleteErr) {
            fileDeletedFromStorage = true;
          }
        }
      } catch (storageErr) {
        console.warn("Storage delete notice:", storageErr);
      }
    }

    // 3. Update items_json to clear proof URL
    if (itemsJsonObj && typeof itemsJsonObj === "object") {
      delete itemsJsonObj.payment_proof_url;
      delete itemsJsonObj.paymentProofUrl;
    }

    const updatedItemsJson = JSON.stringify(itemsJsonObj);

    // 4. Update order_intents row in DB
    const { error: updateErr } = await serviceClient
      .from("order_intents")
      .update({
        payment_proof_url: null,
        items_json: updatedItemsJson,
      })
      .eq("id", numericId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Bukti pembayaran berhasil dihapus dari storage",
      fileDeletedFromStorage,
    });
  } catch (err) {
    console.error("Delete proof API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
