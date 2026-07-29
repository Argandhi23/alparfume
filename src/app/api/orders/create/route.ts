import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cleanPayload } = body;

    if (!cleanPayload || typeof cleanPayload !== "object") {
      return NextResponse.json({ error: "Payload pesanan tidak valid" }, { status: 400 });
    }

    const { product_name, customer_name, customer_wa, customer_address } = cleanPayload;

    if (!product_name || typeof product_name !== "string" || !product_name.trim()) {
      return NextResponse.json({ error: "Nama produk wajib diisi" }, { status: 400 });
    }

    if (!customer_name || typeof customer_name !== "string" || !customer_name.trim()) {
      return NextResponse.json({ error: "Nama pelanggan wajib diisi" }, { status: 400 });
    }

    if (!customer_wa || typeof customer_wa !== "string" || !customer_wa.trim()) {
      return NextResponse.json({ error: "Nomor WhatsApp wajib diisi" }, { status: 400 });
    }

    // Sanitize & format WhatsApp number
    const sanitizedWa = customer_wa.replace(/[^\d+]/g, "").trim();
    if (sanitizedWa.length < 8 || sanitizedWa.length > 20) {
      return NextResponse.json({ error: "Nomor WhatsApp tidak valid" }, { status: 400 });
    }

    // Sanitize string inputs to prevent long payload abuse
    const sanitizedPayload = {
      ...cleanPayload,
      product_name: String(product_name).slice(0, 255).trim(),
      customer_name: String(customer_name).slice(0, 150).trim(),
      customer_wa: sanitizedWa,
      customer_address: customer_address ? String(customer_address).slice(0, 1000).trim() : null,
      price: Number(cleanPayload.price) || 0,
      total_price: Number(cleanPayload.price || cleanPayload.total_price) || 0,
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Use service role key client to bypass RLS restrictions for public checkout
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await serviceClient
      .from("order_intents")
      .insert([sanitizedPayload])
      .select()
      .single();

    if (error) {
      console.error("Database insert error in /api/orders/create:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Order creation API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
