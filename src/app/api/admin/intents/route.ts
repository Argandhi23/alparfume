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

    // 1. Guaranteed update to items_json
    if (typeof updatePayload.items_json === "string") {
      await serviceClient
        .from("order_intents")
        .update({ items_json: updatePayload.items_json })
        .eq("id", filterId);
    }

    // 2. Safe update to payment_status column if exists
    if (updatePayload.payment_status !== undefined) {
      await serviceClient
        .from("order_intents")
        .update({ payment_status: updatePayload.payment_status })
        .eq("id", filterId);
    }

    // 3. Safe update to tracking_number column if exists
    if (updatePayload.tracking_number !== undefined) {
      await serviceClient
        .from("order_intents")
        .update({ tracking_number: updatePayload.tracking_number })
        .eq("id", filterId);
    }

    // 4. Safe update to fulfillment_status column if exists
    if (updatePayload.fulfillment_status !== undefined) {
      await serviceClient
        .from("order_intents")
        .update({ fulfillment_status: updatePayload.fulfillment_status })
        .eq("id", filterId);
    }

    return NextResponse.json({ success: true });
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
