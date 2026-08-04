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
    const isIntegerId = !isNaN(numericId) && String(numericId) === orderIdStr && numericId > 0;

    // A. Check new 'orders' table first (with JOIN to payment_proofs)
    let newOrderQuery = serviceClient
      .from("orders")
      .select("*, payment_proofs(*)");

    if (isIntegerId) {
      newOrderQuery = newOrderQuery.or(`id.eq.${numericId},order_code.eq.${orderIdStr}`);
    } else {
      newOrderQuery = newOrderQuery.or(`order_code.eq.${orderIdStr},order_code.ilike.%${orderIdStr}%`);
    }

    const { data: newOrders } = await newOrderQuery.limit(1);

    if (newOrders && newOrders.length > 0) {
      const order = newOrders[0];
      const proofs = Array.isArray(order.payment_proofs) ? order.payment_proofs : [];
      let fileDeletedFromStorage = false;

      // Delete storage files for any payment proofs associated with this order
      for (const proof of proofs) {
        if (proof.image_url && typeof proof.image_url === "string" && !proof.image_url.startsWith("data:")) {
          try {
            const urlParts = proof.image_url.split("/");
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
      }

      // Delete records from 'payment_proofs' table for this order
      const { error: deleteProofErr } = await serviceClient
        .from("payment_proofs")
        .delete()
        .eq("order_id", order.id);

      if (deleteProofErr) {
        console.error("Error deleting rows from payment_proofs:", deleteProofErr);
        return NextResponse.json({ error: deleteProofErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Bukti pembayaran berhasil dihapus",
        fileDeletedFromStorage,
      });
    }

    // B. Fallback to legacy 'order_intents' table (UUID or string order_code)
    let legacyQuery = serviceClient.from("order_intents").select("*");
    if (isIntegerId) {
      legacyQuery = legacyQuery.eq("order_code", orderIdStr);
    } else {
      legacyQuery = legacyQuery.or(`id.eq.${orderIdStr},order_code.eq.${orderIdStr}`);
    }

    const { data: legacyOrders, error: fetchErr } = await legacyQuery;
    const legacyOrder = legacyOrders && legacyOrders.length > 0 ? legacyOrders[0] : null;

    if (fetchErr || !legacyOrder) {
      // Direct update fallback attempt by ID if string
      if (!isIntegerId) {
        const { error: directUpdateErr } = await serviceClient
          .from("order_intents")
          .update({ payment_proof_url: null })
          .eq("id", orderIdStr);

        if (!directUpdateErr) {
          return NextResponse.json({
            success: true,
            message: "Bukti pembayaran berhasil diperbarui",
            fileDeletedFromStorage: false,
          });
        }
      }

      return NextResponse.json({ error: `Pesanan (${orderIdStr}) tidak ditemukan` }, { status: 404 });
    }

    let proofUrlToDelete = legacyOrder.payment_proof_url || "";
    let itemsJsonObj: Record<string, unknown> = {};

    if (legacyOrder.items_json) {
      try {
        const parsed = JSON.parse(legacyOrder.items_json);
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

    // Delete physical image file from Supabase Storage 'payment-proofs' bucket if applicable
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

    // Clean items_json
    if (itemsJsonObj && typeof itemsJsonObj === "object") {
      delete itemsJsonObj.payment_proof_url;
      delete itemsJsonObj.paymentProofUrl;
    }

    const updatedItemsJson = JSON.stringify(itemsJsonObj);

    // Update order_intents row in DB
    const { error: updateErr } = await serviceClient
      .from("order_intents")
      .update({
        payment_proof_url: null,
        items_json: updatedItemsJson,
      })
      .eq("id", legacyOrder.id);

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
