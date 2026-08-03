import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const serviceClient = getServiceClient();
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");

    let pageData: unknown[] = [];
    let totalCount = 0;

    // 1. Fetch from new 'orders' table
    let orderQuery = serviceClient
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        order_items(*),
        payment_proofs(*)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (limitParam !== "all") {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(limitParam || "15", 10);
      const safePage = isNaN(page) || page < 1 ? 1 : page;
      const safeLimit = isNaN(limit) || limit < 1 ? 15 : limit;
      const fromIndex = (safePage - 1) * safeLimit;
      const toIndex = fromIndex + safeLimit - 1;
      orderQuery = orderQuery.range(fromIndex, toIndex);
    }

    const { data: newOrders, count: newCount, error: newErr } = await orderQuery;

    if (!newErr && newOrders && newOrders.length > 0) {
      totalCount = newCount || newOrders.length;
      pageData = newOrders.map((order) => {
        const proofs = Array.isArray(order.payment_proofs)
          ? order.payment_proofs.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : [];
        const latestProofUrl = proofs.length > 0 ? proofs[0].image_url : null;

        const itemsList = (order.order_items || []).map((item: { product_name_snapshot: string; size_ml_snapshot: number; qty: number; price_snapshot: number; total_price: number }) => ({
          productName: item.product_name_snapshot,
          sizeMl: item.size_ml_snapshot,
          quantity: item.qty,
          price: item.price_snapshot,
          totalItemPrice: item.total_price
        }));

        return {
          id: order.id,
          order_code: order.order_code,
          customer_name: order.customer?.name || "Pelanggan AL Parfume",
          customer_wa: order.customer?.wa_number || "",
          customer_address: order.customer?.address || null,
          order_notes: order.order_notes,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status,
          tracking_number: order.tracking_number,
          subtotal: order.subtotal,
          shipping_cost: order.shipping_cost,
          delivery_method: order.delivery_method,
          grand_total: order.grand_total,
          total_price: order.grand_total,
          price: order.grand_total,
          payment_proof_url: latestProofUrl,
          items_json: JSON.stringify({ items: itemsList }),
          created_at: order.created_at,
          product_name: itemsList.length > 0 ? itemsList[0].productName : "Pesanan Parfum",
          size_ml: itemsList.length > 0 ? itemsList[0].sizeMl : 35,
        };
      });

      return NextResponse.json({ data: pageData, totalCount });
    }

    // 2. Fallback to order_intents if orders table is empty
    let fallbackQuery = serviceClient
      .from("order_intents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (limitParam !== "all") {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(limitParam || "15", 10);
      const safePage = isNaN(page) || page < 1 ? 1 : page;
      const safeLimit = isNaN(limit) || limit < 1 ? 15 : limit;
      const fromIndex = (safePage - 1) * safeLimit;
      const toIndex = fromIndex + safeLimit - 1;
      fallbackQuery = fallbackQuery.range(fromIndex, toIndex);
    }

    const { data: legacyData, count: legacyCount, error: legacyErr } = await fallbackQuery;

    if (legacyErr) {
      return NextResponse.json({ error: legacyErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: legacyData || [], totalCount: legacyCount || 0 });
  } catch (err) {
    console.error("API Route GET Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const adminEmail = auth.email || `admin_${auth.userId?.slice(0, 8) || 'sys'}@alparfume.com`;
    const serviceClient = getServiceClient();

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { id, updates } = body;

    if (!id || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Bad Request: Missing id or updates object" }, { status: 400 });
    }

    const queryCode = id.toString().trim();
    const numericId = parseInt(queryCode, 10);
    const updatePayload = updates as Record<string, unknown>;

    // 1. Try finding target order in new 'orders' table
    let orderSearchQuery = serviceClient.from("orders").select("*, order_items(*)");
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      orderSearchQuery = orderSearchQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      orderSearchQuery = orderSearchQuery.or(`order_code.eq.${queryCode},order_code.ilike.%${queryCode}%`);
    }

    const { data: foundOrders } = await orderSearchQuery.limit(1);

    if (foundOrders && foundOrders.length > 0) {
      const order = foundOrders[0];
      const oldPaymentStatus = order.payment_status;
      const oldFulfillmentStatus = order.fulfillment_status;

      const newPaymentStatus = updatePayload.payment_status !== undefined
        ? String(updatePayload.payment_status)
        : oldPaymentStatus;
      const newFulfillmentStatus = updatePayload.fulfillment_status !== undefined
        ? String(updatePayload.fulfillment_status)
        : oldFulfillmentStatus;

      // ========================================================
      // GUARD 1: Transition to 'paid' (Deduct Stock)
      // TEST 1 & TEST 4: Only deduct if old status was NOT 'paid' and new status IS 'paid'
      // ========================================================
      if (oldPaymentStatus !== "paid" && newPaymentStatus === "paid") {
        const items = order.order_items || [];
        const deductedItems: { variant_id: string; qty: number }[] = [];

        for (const item of items) {
          if (item.variant_id) {
            // Call Postgres Atomic function
            const { data: isSuccess, error: rpcErr } = await serviceClient.rpc(
              "deduct_product_stock",
              {
                p_variant_id: item.variant_id,
                p_qty: Number(item.qty || 1),
                p_order_id: order.id,
              }
            );

            if (rpcErr || isSuccess === false) {
              console.warn(`[Stock Error] Failed to deduct variant ${item.variant_id}:`, rpcErr?.message || "Stok tidak cukup");

              // Rollback any items deducted in this request
              for (const prev of deductedItems) {
                await serviceClient.rpc("restore_product_stock", {
                  p_variant_id: prev.variant_id,
                  p_qty: prev.qty,
                  p_order_id: order.id,
                  p_reason: "rollback",
                });
              }

              return NextResponse.json(
                {
                  error: `Stok tidak cukup untuk produk "${item.product_name_snapshot}" (${item.size_ml_snapshot}ml). Pembayaran ditolak.`,
                  outOfStockItem: item.product_name_snapshot,
                },
                { status: 400 }
              );
            }

            deductedItems.push({ variant_id: item.variant_id, qty: Number(item.qty || 1) });
          }
        }
      }

      // ========================================================
      // GUARD 2: Anti-Double-Deduct Guard
      // TEST 2: If old status IS 'paid' and new status IS ALSO 'paid', DO NOT DEDUCT AGAIN!
      // ========================================================
      // (Handled automatically by checking oldPaymentStatus !== 'paid' above)

      // ========================================================
      // GUARD 3: Transition from 'paid' to 'cancelled' (Restore Stock)
      // TEST 3: Restore stock if previously paid and now cancelled
      // ========================================================
      if (oldPaymentStatus === "paid" && newPaymentStatus === "cancelled") {
        const items = order.order_items || [];

        for (const item of items) {
          if (item.variant_id) {
            await serviceClient.rpc("restore_product_stock", {
              p_variant_id: item.variant_id,
              p_qty: Number(item.qty || 1),
              p_order_id: order.id,
              p_reason: "cancellation",
            });
          }
        }
      }

      // ========================================================
      // GUARD 5: Audit Log (order_status_log)
      // Record who changed the status with admin's session email
      // ========================================================
      if (updatePayload.payment_status !== undefined && oldPaymentStatus !== newPaymentStatus) {
        await serviceClient.from("order_status_log").insert([{
          order_id: order.id,
          status_type: "payment",
          status_value: newPaymentStatus,
          changed_by: adminEmail,
        }]);
      }

      if (updatePayload.fulfillment_status !== undefined && oldFulfillmentStatus !== newFulfillmentStatus) {
        await serviceClient.from("order_status_log").insert([{
          order_id: order.id,
          status_type: "fulfillment",
          status_value: newFulfillmentStatus,
          changed_by: adminEmail,
        }]);
      }

      // Perform update on 'orders' table
      const orderDbUpdates: Record<string, unknown> = {};
      if (updatePayload.payment_status !== undefined) orderDbUpdates.payment_status = updatePayload.payment_status;
      if (updatePayload.fulfillment_status !== undefined) orderDbUpdates.fulfillment_status = updatePayload.fulfillment_status;
      if (updatePayload.tracking_number !== undefined) orderDbUpdates.tracking_number = updatePayload.tracking_number;

      const { error: orderUpdateErr } = await serviceClient
        .from("orders")
        .update(orderDbUpdates)
        .eq("id", order.id);

      if (orderUpdateErr) {
        console.error("Error updating orders table:", orderUpdateErr);
        return NextResponse.json({ error: orderUpdateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, targetId: order.id });
    }

    // 2. Fallback: Target order in legacy 'order_intents' table
    let legacySearchQuery = serviceClient.from("order_intents").select("*");
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      legacySearchQuery = legacySearchQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      legacySearchQuery = legacySearchQuery.or(`order_code.eq.${queryCode},id.eq.${queryCode},items_json.ilike.%${queryCode}%`);
    }

    const { data: legacyOrders } = await legacySearchQuery.limit(1);

    if (legacyOrders && legacyOrders.length > 0) {
      const legacyOrder = legacyOrders[0];

      const legacyUpdates: Record<string, unknown> = {};
      if (updatePayload.payment_status !== undefined) legacyUpdates.payment_status = updatePayload.payment_status;
      if (updatePayload.fulfillment_status !== undefined) legacyUpdates.fulfillment_status = updatePayload.fulfillment_status;
      if (updatePayload.tracking_number !== undefined) legacyUpdates.tracking_number = updatePayload.tracking_number;

      await serviceClient
        .from("order_intents")
        .update(legacyUpdates)
        .eq("id", legacyOrder.id);

      return NextResponse.json({ success: true, targetId: legacyOrder.id });
    }

    return NextResponse.json({ error: `Pesanan dengan ID/Kode "${id}" tidak ditemukan` }, { status: 404 });
  } catch (err) {
    console.error("API Route PATCH Catch Error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const serviceClient = getServiceClient();
    const body: { ids?: (string | number)[] } = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Bad Request: Missing or invalid ids array" }, { status: 400 });
    }

    // Try deleting from 'orders' first
    await serviceClient
      .from("orders")
      .delete()
      .in("id", ids);

    // Fallback: Delete from 'order_intents' if any legacy IDs
    await serviceClient
      .from("order_intents")
      .delete()
      .in("id", ids);

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error("API Route DELETE Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
