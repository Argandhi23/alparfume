import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rateLimit";

export const revalidate = 0;

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function maskWaNumber(wa: string | null | undefined): string | null {
  if (!wa) return null;
  const clean = wa.replace(/[^\d]/g, "");
  if (clean.length < 8) return "0819****1190";
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

function maskAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return address;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeParam = searchParams.get("code") || searchParams.get("id");
    const queryCode = (codeParam || "").trim().toUpperCase();

    // Protection: Public status endpoint ONLY accepts string order_code (e.g. ORD-xxxxx). Numeric integer sequential IDs are strictly rejected.
    const isNumericInteger = /^\d+$/.test(queryCode);
    if (!queryCode || isNumericInteger) {
      return NextResponse.json(
        { error: "Pencarian pesanan publik hanya diizinkan menggunakan Kode Pesanan (Order Code) resmi" },
        { status: 400 }
      );
    }

    // Layer 1 Rate Limit: IP Global Guard (Max 200 requests/60s across all order_codes from this IP)
    const globalLimit = checkRateLimit(request, 200, 60 * 1000, "global_orders_status");
    if (!globalLimit.success) {
      return globalLimit.response!;
    }

    // Layer 2 Rate Limit: Composite Key Guard (Max 60 requests/60s per order_code from this IP)
    const orderLimit = checkRateLimit(request, 60, 60 * 1000, `order_status:${queryCode}`);
    if (!orderLimit.success) {
      return orderLimit.response!;
    }

    const serviceClient = getServiceClient();

    // 1. Query new 'orders' table with JOIN customers, order_items, payment_proofs strictly by order_code
    const { data: orders, error: orderErr } = await serviceClient
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        order_items(*),
        payment_proofs(*)
      `)
      .eq("order_code", queryCode)
      .limit(1);

    if (!orderErr && orders && orders.length > 0) {
      const order = orders[0];
      
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

      return NextResponse.json({
        success: true,
        source: "orders",
        data: {
          order_code: order.order_code,
          customer_name: order.customer?.name || null,
          customer_wa: maskWaNumber(order.customer?.wa_number),
          customer_address: maskAddress(order.customer?.address),
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
          items: itemsList
        }
      });
    }

    // 2. Fallback Hibrid: Query historical 'order_intents' table strictly by order_code
    const { data: intents, error: intentErr } = await serviceClient
      .from("order_intents")
      .select("*")
      .eq("order_code", queryCode)
      .limit(1);

    if (!intentErr && intents && intents.length > 0) {
      const intent = intents[0];
      const safeIntent = { ...intent };
      delete (safeIntent as { id?: unknown }).id;
      return NextResponse.json({
        success: true,
        source: "order_intents",
        data: {
          ...safeIntent,
          customer_wa: maskWaNumber(intent.customer_wa),
          customer_address: maskAddress(intent.customer_address),
        }
      });
    }

    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  } catch (err) {
    console.error("Error in /api/orders/status:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
