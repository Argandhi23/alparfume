import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // 1. Fetch target order by id (number or string) or order_code
    const orderIdStr = String(orderId).trim();
    const numericId = parseInt(orderIdStr, 10);

    let query = serviceClient.from("order_intents").select("*");
    if (!isNaN(numericId) && numericId.toString() === orderIdStr) {
      query = query.or(`id.eq.${numericId},order_code.eq.${orderIdStr}`);
    } else {
      query = query.or(`id.eq.${orderIdStr},order_code.eq.${orderIdStr}`);
    }

    const { data: orders, error: fetchErr } = await query;
    const order = orders && orders.length > 0 ? orders[0] : null;

    if (fetchErr || !order) {
      // Direct update fallback attempt by ID
      const { error: directUpdateErr } = await serviceClient
        .from("order_intents")
        .update({ payment_proof_url: null })
        .eq("id", isNaN(numericId) ? orderIdStr : numericId);

      if (!directUpdateErr) {
        return NextResponse.json({
          success: true,
          message: "Bukti pembayaran berhasil diperbarui",
          fileDeletedFromStorage: false,
        });
      }

      return NextResponse.json({ error: `Pesanan (${orderIdStr}) tidak ditemukan` }, { status: 404 });
    }

    let proofUrlToDelete = order.payment_proof_url || "";
    let itemsJsonObj: Record<string, unknown> = {};

    if (order.items_json) {
      try {
        const parsed = JSON.parse(order.items_json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          itemsJsonObj = parsed;
          if (!proofUrlToDelete && (parsed.payment_proof_url || parsed.paymentProofUrl)) {
            proofUrlToDelete = parsed.payment_proof_url || parsed.paymentProofUrl;
          }
        }
      } catch {
        // ignore parse error
      }
    }

    // 2. Delete physical image file from Supabase Storage 'payment-proofs' bucket if applicable
    let fileDeletedFromStorage = false;
    if (proofUrlToDelete && typeof proofUrlToDelete === "string" && !proofUrlToDelete.startsWith("data:")) {
      try {
        const urlParts = proofUrlToDelete.split("/");
        const lastPart = urlParts[urlParts.length - 1];
        const rawFileName = lastPart ? lastPart.split("?")[0] : "";

        if (rawFileName) {
          const { error: deleteErr } = await serviceClient.storage
            .from("payment-proofs")
            .remove([rawFileName]);

          if (!deleteErr) {
            fileDeletedFromStorage = true;
          }
        }
      } catch (storageErr) {
        console.warn("Storage removal notice:", storageErr);
      }
    }

    // 3. Clean items_json
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
      .eq("id", order.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Bukti pembayaran berhasil dihapus",
      fileDeletedFromStorage,
    });
  } catch (err) {
    console.error("Delete proof API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
