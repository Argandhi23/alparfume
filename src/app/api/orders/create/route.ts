import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateServerCourierCost } from "@/lib/shippingTariff";
import { buildOrderConfirmationMessage, sendFonnteMessage } from "@/lib/whatsappGateway";

interface ProductVariant {
  id: string; // UUID
  product_id: string;
  size_ml: number;
  price: number;
  stock: number;
}

interface ProductWithVariants {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  is_sold_out?: boolean;
  stock?: number;
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

    // 1. Parse items metadata to extract product identifiers
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

    // Collect targeted product IDs, Slugs, and Names for optimized DB query
    const targetSlugs = Array.from(new Set(
      rawItems
        .map((i) => String(i.productSlug || i.slug || i.product_slug || "").trim().toLowerCase())
        .filter(Boolean)
    ));
    const targetIds = Array.from(new Set(
      rawItems
        .map((i) => String(i.productId || i.product_id || i.id || "").trim())
        .filter(Boolean)
    ));
    const targetNames = Array.from(new Set(
      rawItems
        .map((i) => String(i.productName || i.name || i.product_name || "").trim())
        .filter(Boolean)
    ));

    // Fetch ONLY relevant products & variants for price verification
    let productsQuery = serviceClient.from("products").select("*, product_variants(*)");

    if (targetIds.length > 0) {
      productsQuery = productsQuery.in("id", targetIds);
    } else if (targetSlugs.length > 0) {
      productsQuery = productsQuery.in("slug", targetSlugs);
    } else if (targetNames.length > 0) {
      productsQuery = productsQuery.in("name", targetNames);
    }

    const { data: dbProducts } = await productsQuery;

    const productsList: ProductWithVariants[] = Array.isArray(dbProducts) ? dbProducts : [];

    // 2. Server-Side Price & Stock Verification per Item
    let serverSubtotal = 0;
    let totalItemQuantity = 0;
    const validatedItems: {
      productName: string;
      productSlug: string;
      sizeMl: number;
      quantity: number;
      price: number;
      totalItemPrice: number;
      variantId: string | null;
    }[] = [];

    for (const item of rawItems) {
      const itemSlug = String(item.productSlug || item.slug || "").trim().toLowerCase();
      const itemName = String(item.productName || item.name || cleanPayload.product_name || "").trim();
      const isSampleProduct = itemName.toLowerCase().includes("sample") || itemSlug.includes("sample");
      const defaultSize = isSampleProduct ? 10 : 30;
      const rawSize = Number(item.sizeMl || item.size_ml);
      const itemSize = (isSampleProduct || (rawSize > 0 && rawSize <= 15)) ? 10 : (rawSize || defaultSize);
      const itemQty = Math.max(1, Math.min(100, Math.floor(Number(item.quantity || item.qty) || 1)));

      let matchedUnitPrice = 0;
      let matchedVariantId: string | null = null;
      let resolvedSizeMl = itemSize;

      // Find matching product in database
      const matchedProduct = productsList.find(
        (p) =>
          (itemSlug && p.slug?.toLowerCase() === itemSlug) ||
          (p.name && p.name.toLowerCase() === itemName.toLowerCase())
      );

      if (matchedProduct) {
        // Guard 1: Reject inactive or sold-out products before order creation
        if (matchedProduct.is_active === false || matchedProduct.is_sold_out === true) {
          return NextResponse.json(
            { error: `Maaf, produk "${matchedProduct.name}" sedang habis (Sold Out).` },
            { status: 400 }
          );
        }

        if (typeof matchedProduct.stock === "number" && matchedProduct.stock < itemQty) {
          return NextResponse.json(
            {
              error:
                matchedProduct.stock <= 0
                  ? `Maaf, stok untuk produk "${matchedProduct.name}" sudah habis.`
                  : `Maaf, stok untuk produk "${matchedProduct.name}" hanya tersisa ${matchedProduct.stock} pcs.`,
            },
            { status: 400 }
          );
        }

        if (matchedProduct.product_variants && matchedProduct.product_variants.length > 0) {
          // Prefer exact size match; otherwise pick closest size (preferring higher price on tie to prevent underpricing)
          const exactVariant = matchedProduct.product_variants.find(
            (v) => Number(v.size_ml) === itemSize
          );
          const closestVariant = [...matchedProduct.product_variants].sort((a, b) => {
            const diffA = Math.abs(Number(a.size_ml) - itemSize);
            const diffB = Math.abs(Number(b.size_ml) - itemSize);
            if (diffA !== diffB) return diffA - diffB;
            return (Number(b.price) || 0) - (Number(a.price) || 0);
          })[0];

          const matchedVariant = exactVariant || closestVariant;

          if (matchedVariant) {
            if (typeof matchedVariant.stock === "number" && matchedVariant.stock < itemQty) {
              return NextResponse.json(
                {
                  error:
                    matchedVariant.stock <= 0
                      ? `Maaf, varian "${matchedProduct.name}" (${matchedVariant.size_ml}ml) sedang habis.`
                      : `Maaf, stok "${matchedProduct.name}" (${matchedVariant.size_ml}ml) hanya tersisa ${matchedVariant.stock} pcs.`,
                },
                { status: 400 }
              );
            }

            if (typeof matchedVariant.price === "number" && matchedVariant.price > 0) {
              matchedUnitPrice = matchedVariant.price;
            }
            matchedVariantId = matchedVariant.id;
            resolvedSizeMl = Number(matchedVariant.size_ml) || itemSize;
          }
        }
      }

      // Safety fallback if product/variant had no price in DB
      if (matchedUnitPrice <= 0) {
        if (isSampleProduct || resolvedSizeMl <= 15) matchedUnitPrice = 25000;
        else if (resolvedSizeMl === 30) matchedUnitPrice = 45000;
        else if (resolvedSizeMl === 50) matchedUnitPrice = 75000;
        else if (resolvedSizeMl === 100) matchedUnitPrice = 135000;
        else matchedUnitPrice = 45000;
      }

      const itemTotal = matchedUnitPrice * itemQty;
      serverSubtotal += itemTotal;
      totalItemQuantity += itemQty;

      validatedItems.push({
        productName: matchedProduct?.name || itemName,
        productSlug: matchedProduct?.slug || itemSlug,
        sizeMl: resolvedSizeMl,
        quantity: itemQty,
        price: matchedUnitPrice,
        totalItemPrice: itemTotal,
        variantId: matchedVariantId,
      });
    }

    const sanitizedCustomerName = String(customer_name).slice(0, 150).trim();
    const sanitizedAddress = customer_address ? String(customer_address).slice(0, 1000).trim() : null;
    const sanitizedOrderNotes = cleanPayload.order_notes ? String(cleanPayload.order_notes).slice(0, 500).trim() : null;

    // 3. Server-Side Shipping Cost Calculation (Zero-Trust Regional Floor Protection)
    const deliveryMethod = String(parsedMeta.delivery_method || cleanPayload.delivery_method || "courier");
    let validatedShippingCost = 0;

    if (deliveryMethod === "courier") {
      const requestedShippingCost = Number(parsedMeta.shipping_cost ?? cleanPayload.shipping_cost);
      validatedShippingCost = validateServerCourierCost(
        requestedShippingCost,
        sanitizedAddress || "",
        totalItemQuantity
      );
    } else {
      validatedShippingCost = 0;
    }

    // 4. Server Grand Total Price
    const serverGrandTotal = serverSubtotal + validatedShippingCost;

    // 5. Find or Create Customer in 'customers' table
    let customerId: string | null = null;
    const { data: existingCustomer } = await serviceClient
      .from("customers")
      .select("id")
      .eq("wa_number", sanitizedWa)
      .eq("name", sanitizedCustomerName)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCust, error: custErr } = await serviceClient
        .from("customers")
        .insert([{
          name: sanitizedCustomerName,
          wa_number: sanitizedWa,
          address: sanitizedAddress
        }])
        .select("id")
        .single();

      if (custErr) {
        console.error("Error creating customer in /api/orders/create:", custErr);
        return NextResponse.json({ error: "Gagal menyimpan data pelanggan" }, { status: 500 });
      }
      customerId = newCust.id;
    }

    // 6. Generate Unique Order Code
    const generatedOrderCode = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentMethod = String(cleanPayload.payment_method || parsedMeta.payment_method || (deliveryMethod === "pickup" ? "cod_pickup" : "qris"));
    const initialPaymentStatus = paymentMethod === "cod_pickup" ? "cod_pickup" : "pending_verification";

    // 7. Insert Order into 'orders' table
    const { data: createdOrder, error: orderErr } = await serviceClient
      .from("orders")
      .insert([{
        order_code: generatedOrderCode,
        customer_id: customerId,
        subtotal: serverSubtotal,
        shipping_cost: validatedShippingCost,
        delivery_method: deliveryMethod,
        grand_total: serverGrandTotal,
        payment_method: paymentMethod,
        payment_status: initialPaymentStatus,
        fulfillment_status: "pending",
        order_notes: sanitizedOrderNotes
      }])
      .select()
      .single();

    if (orderErr || !createdOrder) {
      console.error("Error inserting order into 'orders':", orderErr);
      return NextResponse.json({ error: orderErr?.message || "Gagal membuat pesanan baru" }, { status: 500 });
    }

    // 8. Insert Order Items into 'order_items' table
    const orderItemsPayload = validatedItems.map(item => ({
      order_id: createdOrder.id,
      variant_id: item.variantId,
      product_name_snapshot: item.productName,
      size_ml_snapshot: item.sizeMl,
      qty: item.quantity,
      price_snapshot: item.price,
      total_price: item.totalItemPrice
    }));

    const { error: itemsErr } = await serviceClient
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsErr) {
      console.error("Error inserting order_items into DB:", itemsErr);
    }

    // 9. Send Automated WhatsApp Confirmation via Fonnte (Defensive & Non-Blocking)
    let waStatusTag = "[WA: Belum Terkirim]";
    try {
      const originHeader = request.headers.get("origin") || request.headers.get("host") || "";
      const originUrl = originHeader.startsWith("http") ? originHeader : originHeader ? `https://${originHeader}` : "https://alparfume.com";

      const waMessage = buildOrderConfirmationMessage({
        customerName: sanitizedCustomerName,
        orderCode: createdOrder.order_code,
        items: validatedItems.map((item) => ({
          productName: item.productName,
          sizeMl: item.sizeMl,
          quantity: item.quantity,
          price: item.price,
          totalItemPrice: item.totalItemPrice,
        })),
        grandTotal: serverGrandTotal,
        subtotal: serverSubtotal,
        shippingCost: validatedShippingCost,
        paymentMethod: paymentMethod,
        deliveryMethod: deliveryMethod,
        customerAddress: sanitizedAddress,
        originUrl: originUrl,
      });

      const waResult = await sendFonnteMessage(sanitizedWa, waMessage);

      if (waResult.success) {
        waStatusTag = "[WA: Terkirim]";
      } else if (waResult.statusText === "unconfigured") {
        waStatusTag = "[WA: Belum Dikonfigurasi]";
      } else {
        waStatusTag = `[WA: Gagal - ${waResult.error || waResult.statusText}]`;
      }

      // Update order_notes with WA status tag for immediate visibility in admin
      const currentNotes = sanitizedOrderNotes ? `${sanitizedOrderNotes} | ${waStatusTag}` : waStatusTag;
      await serviceClient
        .from("orders")
        .update({ order_notes: currentNotes })
        .eq("id", createdOrder.id);

      // Audit Log in order_status_log
      await serviceClient
        .from("order_status_log")
        .insert([{
          order_id: createdOrder.id,
          status_type: "wa_notification",
          status_value: waResult.success ? "sent" : (waResult.statusText || "failed"),
          changed_by: "system_fonnte",
        }]);
    } catch (waErr) {
      console.error("[Fonnte] Error during automated WA dispatch:", waErr);
    }

    // Format response compatible with frontend expected response
    const formattedData = {
      id: createdOrder.id,
      order_code: createdOrder.order_code,
      product_name: String(product_name).slice(0, 255).trim(),
      customer_name: sanitizedCustomerName,
      customer_wa: sanitizedWa,
      customer_address: sanitizedAddress,
      subtotal: serverSubtotal,
      shipping_cost: validatedShippingCost,
      price: serverGrandTotal,
      total_price: serverGrandTotal,
      grand_total: serverGrandTotal,
      items: validatedItems,
      created_at: createdOrder.created_at
    };

    return NextResponse.json({ success: true, data: formattedData });
  } catch (err) {
    console.error("Order creation API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
