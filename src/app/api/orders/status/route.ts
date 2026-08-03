import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || searchParams.get("id");

    if (!code || !code.trim()) {
      return NextResponse.json({ error: "Parameter kode pesanan wajib diisi" }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const queryCode = code.trim();

    // 1. Query new 'orders' table with JOIN customers, order_items, payment_proofs
    let orderQuery = serviceClient
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        order_items(*),
        payment_proofs(*)
      `);

    const numericId = parseInt(queryCode, 10);
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      orderQuery = orderQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      orderQuery = orderQuery.or(`order_code.eq.${queryCode},order_code.ilike.%${queryCode}%`);
    }

    const { data: orders, error: orderErr } = await orderQuery.limit(1);

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
          id: order.id,
          order_code: order.order_code,
          customer_name: order.customer?.name || null,
          customer_wa: order.customer?.wa_number || null,
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
          items: itemsList
        }
      });
    }

    // 2. Fallback Hibrid: Query historical 'order_intents' table
    let fallbackQuery = serviceClient.from("order_intents").select("*");
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      fallbackQuery = fallbackQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      fallbackQuery = fallbackQuery.or(`order_code.eq.${queryCode},id.eq.${queryCode},items_json.ilike.%${queryCode}%`);
    }

    const { data: intents, error: intentErr } = await fallbackQuery.limit(1);

    if (!intentErr && intents && intents.length > 0) {
      const intent = intents[0];
      return NextResponse.json({
        success: true,
        source: "order_intents",
        data: intent
      });
    }

    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  } catch (err) {
    console.error("Error in /api/orders/status:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
