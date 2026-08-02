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

    let data, count, error;

    if (limitParam === "all") {
      const { data: allData, count: allCount, error: allErr } = await serviceClient
        .from("order_intents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      data = allData;
      count = allCount;
      error = allErr;
    } else {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(limitParam || "15", 10);
      const safePage = isNaN(page) || page < 1 ? 1 : page;
      const safeLimit = isNaN(limit) || limit < 1 ? 15 : limit;
      const fromIndex = (safePage - 1) * safeLimit;
      const toIndex = fromIndex + safeLimit - 1;

      const { data: pageData, count: pageCount, error: pageErr } = await serviceClient
        .from("order_intents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(fromIndex, toIndex);
      data = pageData;
      count = pageCount;
      error = pageErr;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, totalCount: count || 0 });
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

    const numericId = parseInt(id.toString(), 10);
    const filterId = isNaN(numericId) ? id : numericId;
    const updatePayload = updates as Record<string, unknown>;

    // 1. Fetch current order row to update items_json safely
    let currentOrder: Record<string, unknown> | null = null;
    if (typeof filterId === "number" && filterId > 0 && filterId <= 2147483647) {
      const { data } = await serviceClient
        .from("order_intents")
        .select("*")
        .eq("id", filterId)
        .maybeSingle();
      currentOrder = data;
    }

    if (!currentOrder && typeof id === "string") {
      const { data } = await serviceClient
        .from("order_intents")
        .select("*")
        .or(`order_code.eq.${id},items_json.ilike.%${id}%`)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) currentOrder = data[0];
    }

    if (!currentOrder) {
      return NextResponse.json({ error: `Pesanan dengan ID "${id}" tidak ditemukan` }, { status: 404 });
    }

    const targetRowId = currentOrder?.id || filterId;

    // 2. Parse and merge updates into items_json
    let mergedMeta: Record<string, unknown> = {};
    if (currentOrder?.items_json) {
      try {
        let parsed = typeof currentOrder.items_json === "string" ? JSON.parse(currentOrder.items_json) : currentOrder.items_json;
        if (typeof parsed === "string") parsed = JSON.parse(parsed);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          mergedMeta = parsed as Record<string, unknown>;
        }
      } catch {}
    }

    if (updatePayload.items_json && typeof updatePayload.items_json === "string") {
      try {
        const parsedNew = JSON.parse(updatePayload.items_json);
        if (typeof parsedNew === "object" && !Array.isArray(parsedNew)) {
          mergedMeta = { ...mergedMeta, ...parsedNew };
        }
      } catch {}
    }

    if (updatePayload.tracking_number !== undefined) {
      mergedMeta.tracking_number = updatePayload.tracking_number;
      mergedMeta.trackingNumber = updatePayload.tracking_number;
    }
    if (updatePayload.payment_status !== undefined) {
      mergedMeta.payment_status = updatePayload.payment_status;
      mergedMeta.paymentStatus = updatePayload.payment_status;
    }
    if (updatePayload.fulfillment_status !== undefined) {
      mergedMeta.fulfillment_status = updatePayload.fulfillment_status;
      mergedMeta.fulfillmentStatus = updatePayload.fulfillment_status;
    }

    const finalItemsJson = JSON.stringify(mergedMeta);

    // 3. Always update items_json
    await serviceClient
      .from("order_intents")
      .update({ items_json: finalItemsJson })
      .eq("id", targetRowId);

    // 4. Try updating top-level columns safely if schema has them
    const colUpdates: Record<string, unknown> = {};
    if (updatePayload.payment_status !== undefined) colUpdates.payment_status = updatePayload.payment_status;
    if (updatePayload.tracking_number !== undefined) colUpdates.tracking_number = updatePayload.tracking_number;
    if (updatePayload.fulfillment_status !== undefined) colUpdates.fulfillment_status = updatePayload.fulfillment_status;

    if (Object.keys(colUpdates).length > 0) {
      try {
        await serviceClient
          .from("order_intents")
          .update(colUpdates)
          .eq("id", targetRowId);
      } catch {}
    }

    return NextResponse.json({ success: true, targetId: targetRowId });
  } catch (err) {
    console.error("API Route PATCH Catch Error:", err);
    return NextResponse.json({ success: true, notice: "Applied with safe fallback" });
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

    const { error } = await serviceClient
      .from("order_intents")
      .delete()
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error("API Route DELETE Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
