import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

interface ProductVariant {
  id: number;
  product_id: string;
  size_ml: number;
  price: number;
}

interface ProductWithVariants {
  id: string;
  name: string;
  slug: string;
  product_variants?: ProductVariant[];
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, 15, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Use service role client for db operations
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Fetch DB products and variants to re-calculate prices securely on server
    const { data: dbProducts } = await serviceClient
      .from("products")
      .select("*, product_variants(*)");

    const productsList: ProductWithVariants[] = Array.isArray(dbProducts) ? dbProducts : [];

    // Parse items metadata
    let parsedMeta: Record<string, unknown> = {};
    if (cleanPayload.items_json) {
      try {
        let meta = typeof cleanPayload.items_json === "string" 
          ? JSON.parse(cleanPayload.items_json) 
          : cleanPayload.items_json;
        if (typeof meta === "string") meta = JSON.parse(meta);
        if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
          parsedMeta = meta as Record<string, unknown>;
        }
      } catch (err) {
        console.warn("Failed to parse items_json in create order:", err);
      }
    }

    // Extract items list
    let rawItems: Record<string, unknown>[] = [];
    if (Array.isArray(parsedMeta.items) && parsedMeta.items.length > 0) {
      rawItems = parsedMeta.items as Record<string, unknown>[];
    } else if (Array.isArray(cleanPayload.items) && cleanPayload.items.length > 0) {
      rawItems = cleanPayload.items as Record<string, unknown>[];
    } else {
      // Single product fallback
      rawItems = [
        {
          productName: cleanPayload.product_name,
          productSlug: cleanPayload.product_slug || "",
          sizeMl: cleanPayload.size_ml || (String(cleanPayload.product_name || "").toLowerCase().includes("sample") ? 10 : 30),
          quantity: 1,
        },
      ];
    }

    // 2. Server-Side Price Calculation per Item
    let serverSubtotal = 0;
    const validatedItems = rawItems.map((item) => {
      const itemSlug = String(item.productSlug || item.slug || "").trim().toLowerCase();
      const itemName = String(item.productName || item.name || cleanPayload.product_name || "").trim();
      const isSampleProduct = itemName.toLowerCase().includes("sample") || itemSlug.includes("sample");
      const defaultSize = isSampleProduct ? 10 : 30;
      const rawSize = Number(item.sizeMl || item.size_ml);
      const itemSize = (isSampleProduct || (rawSize > 0 && rawSize <= 15)) ? 10 : (rawSize || defaultSize);
      const itemQty = Math.max(1, Math.floor(Number(item.quantity || item.qty) || 1));

      let matchedUnitPrice = 0;

      // Find matching product in database
      const matchedProduct = productsList.find((p) => 
        (itemSlug && p.slug?.toLowerCase() === itemSlug) || 
        (p.name && p.name.toLowerCase() === itemName.toLowerCase())
      );

      if (matchedProduct && matchedProduct.product_variants && matchedProduct.product_variants.length > 0) {
        const matchedVariant = matchedProduct.product_variants.find(
          (v) => Number(v.size_ml) === itemSize
        ) || matchedProduct.product_variants[0];

        if (matchedVariant && typeof matchedVariant.price === "number") {
          matchedUnitPrice = matchedVariant.price;
        }
      }

      // Hardcoded safety fallback if database variant query was empty
      if (matchedUnitPrice <= 0) {
        if (isSampleProduct || itemSize <= 15) matchedUnitPrice = 25000;
        else if (itemSize === 30 || itemSize === 35) matchedUnitPrice = 45000;
        else if (itemSize === 50) matchedUnitPrice = 75000;
        else if (itemSize === 100) matchedUnitPrice = 135000;
        else matchedUnitPrice = 45000;
      }

      const itemTotal = matchedUnitPrice * itemQty;
      serverSubtotal += itemTotal;

      return {
        productName: itemName,
        productSlug: matchedProduct?.slug || itemSlug,
        sizeMl: itemSize,
        quantity: itemQty,
        price: matchedUnitPrice,
        totalItemPrice: itemTotal,
      };
    });

    // 3. Server-Side Shipping Cost Calculation
    const deliveryMethod = String(parsedMeta.delivery_method || cleanPayload.delivery_method || "courier");
    let validatedShippingCost = 0;

    if (deliveryMethod === "courier") {
      const requestedShippingCost = Number(parsedMeta.shipping_cost || cleanPayload.shipping_cost);
      if (!isNaN(requestedShippingCost) && requestedShippingCost >= 0) {
        validatedShippingCost = Math.floor(requestedShippingCost);
      } else {
        validatedShippingCost = 14000; // Default standard courier shipping rate
      }
    } else {
      validatedShippingCost = 0; // Store Pickup / COD Madiun is free
    }

    // 4. Authoritative Server Total Price
    const serverGrandTotal = serverSubtotal + validatedShippingCost;

    // Update items_json metadata with server-computed values
    parsedMeta.items = validatedItems;
    parsedMeta.subtotal = serverSubtotal;
    parsedMeta.shipping_cost = validatedShippingCost;
    parsedMeta.grand_total = serverGrandTotal;
    parsedMeta.delivery_method = deliveryMethod;

    const finalItemsJson = JSON.stringify(parsedMeta);

    // Sanitize payload with server-calculated price
    const sanitizedPayload = {
      ...cleanPayload,
      product_name: String(product_name).slice(0, 255).trim(),
      customer_name: String(customer_name).slice(0, 150).trim(),
      customer_wa: sanitizedWa,
      customer_address: customer_address ? String(customer_address).slice(0, 1000).trim() : null,
      price: serverGrandTotal,
      total_price: serverGrandTotal,
      shipping_cost: validatedShippingCost,
      items_json: finalItemsJson,
    };

    let { data, error } = await serviceClient
      .from("order_intents")
      .insert([sanitizedPayload])
      .select()
      .single();

    // Fallback: If ANY error occurs (schema mismatch, missing column, PGRST204, etc.), retry with guaranteed core payload
    if (error) {
      console.warn("Retrying order creation with guaranteed core payload:", error.message);
      
      const corePayload = {
        product_name: String(product_name).slice(0, 255).trim(),
        size_ml: Number(cleanPayload.size_ml) || 35,
        price: serverGrandTotal,
        customer_name: String(customer_name).slice(0, 150).trim(),
        customer_wa: sanitizedWa,
        customer_address: customer_address ? String(customer_address).slice(0, 1000).trim() : null,
        order_notes: cleanPayload.order_notes ? String(cleanPayload.order_notes).slice(0, 500).trim() : null,
        items_json: finalItemsJson,
      };

      const fallbackResult = await serviceClient
        .from("order_intents")
        .insert([corePayload])
        .select()
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

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

