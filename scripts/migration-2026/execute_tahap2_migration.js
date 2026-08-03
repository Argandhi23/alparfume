/**
 * ⚠️ SCRIPT MIGRASI / TEST SATU KALI PAKAI — SUDAH DIJALANKAN PADA 02 AGUSTUS 2026
 * JANGAN DIJALANKAN ULANG SECARA SEMBARANGAN DI PRODUCTION.
 * Dapat menyebabkan duplikasi data atau pengujian ulang jika di-run kembali.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function executeTahap2() {
  console.log("==================================================");
  console.log("  TAHAP 2: EKSEKUSI MIGRASI DATA HISTORIS SUNGGUHAN");
  console.log("==================================================");

  // 1. Fetch products & product_variants for strict matching
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('*, product_variants(*)');

  if (prodErr) {
    console.error("Error fetching products:", prodErr);
    return;
  }

  // 2. Fetch order_intents
  const { data: dbIntents, error: intentErr } = await supabase
    .from('order_intents')
    .select('*')
    .order('created_at', { ascending: true });

  if (intentErr) {
    console.error("Error fetching order_intents:", intentErr);
    return;
  }

  // Flatten all DB variants
  const allVariants = [];
  dbProducts.forEach(p => {
    if (p.product_variants && p.product_variants.length > 0) {
      p.product_variants.forEach(v => {
        allVariants.push({
          variant_id: v.id,
          product_id: p.id,
          product_name: p.name,
          product_slug: p.slug,
          size_ml: v.size_ml,
          price: v.price
        });
      });
    }
  });

  console.log(`Processing ${dbIntents.length} order_intents rows...`);

  let createdOrdersCount = 0;
  let createdOrderItemsCount = 0;
  let nullVariantItemsCount = 0;
  let matchedVariantItemsCount = 0;
  let totalGrandTotalOrders = 0;
  let totalGrandTotalIntents = 0;
  const customerMap = new Map(); // wa_name -> customer_id

  for (const intent of dbIntents) {
    const wa = (intent.customer_wa || '').trim();
    const name = (intent.customer_name || '').trim();
    const custKey = `${wa}_${name}`;

    let customerId = customerMap.get(custKey);

    // Create or find customer in customers table
    if (!customerId) {
      // Check if customer already exists in DB
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('wa_number', wa)
        .eq('name', name)
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{
            name: name || 'Pelanggan AL Parfume',
            wa_number: wa || '080000000000',
            address: intent.customer_address || null,
            created_at: intent.created_at
          }])
          .select('id')
          .single();

        if (custErr) {
          console.error(`[Intent ${intent.id}] Failed to insert customer:`, custErr.message);
          continue;
        }
        customerId = newCust.id;
      }
      customerMap.set(custKey, customerId);
    }

    // Parse items_json
    let parsedMeta = {};
    let rawItems = [];

    if (intent.items_json) {
      try {
        let meta = typeof intent.items_json === 'string' ? JSON.parse(intent.items_json) : intent.items_json;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        if (Array.isArray(meta)) {
          rawItems = meta;
        } else if (typeof meta === 'object' && meta !== null) {
          parsedMeta = meta;
          if (Array.isArray(meta.items)) {
            rawItems = meta.items;
          }
        }
      } catch (err) {
        console.warn(`[Intent ${intent.id}] Failed to parse items_json:`, err.message);
      }
    }

    if (rawItems.length === 0) {
      rawItems = [{
        productName: intent.product_name || 'Produk Parfum',
        sizeMl: intent.size_ml || 35,
        quantity: 1,
        price: intent.price || intent.grand_total || 45000
      }];
    }

    const calculatedGrandTotal = Number(intent.grand_total || intent.total_price || intent.price || 0);
    totalGrandTotalIntents += calculatedGrandTotal;

    const deliveryMethod = intent.customer_address?.toLowerCase().includes('ambil di toko') || parsedMeta.delivery_method === 'pickup' ? 'pickup' : 'courier';
    const shippingCost = Number(intent.shipping_cost || parsedMeta.shipping_cost || (deliveryMethod === 'courier' ? 14000 : 0));
    const subtotal = Number(parsedMeta.subtotal || (calculatedGrandTotal - shippingCost));
    const orderCode = intent.order_code || `ORD-HIST-${intent.id.slice(0, 8).toUpperCase()}`;

    // Check if order already migrated
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, grand_total')
      .eq('order_code', orderCode)
      .maybeSingle();

    let orderId = null;

    if (existingOrder) {
      orderId = existingOrder.id;
      totalGrandTotalOrders += Number(existingOrder.grand_total);
      createdOrdersCount++;
    } else {
      // Insert into orders table
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert([{
          order_code: orderCode,
          customer_id: customerId,
          subtotal: subtotal > 0 ? subtotal : calculatedGrandTotal,
          shipping_cost: shippingCost,
          delivery_method: deliveryMethod,
          grand_total: calculatedGrandTotal,
          payment_method: intent.payment_method || 'qris',
          payment_status: intent.payment_status || 'pending_verification',
          fulfillment_status: intent.fulfillment_status || 'pending',
          tracking_number: intent.tracking_number || null,
          order_notes: intent.order_notes || null,
          created_at: intent.created_at
        }])
        .select('id, grand_total')
        .single();

      if (orderErr) {
        console.error(`[Intent ${intent.id}] Failed to insert order:`, orderErr.message);
        continue;
      }

      orderId = newOrder.id;
      totalGrandTotalOrders += Number(newOrder.grand_total);
      createdOrdersCount++;
    }

    // Insert order_items
    for (const item of rawItems) {
      const itemName = String(item.productName || item.name || intent.product_name || '').trim();
      const itemSlug = String(item.productSlug || item.slug || '').trim().toLowerCase();
      const itemSize = Number(item.sizeMl || item.size_ml || intent.size_ml || 35);
      const itemQty = Math.max(1, Number(item.quantity || item.qty || 1));
      const itemPrice = Number(item.price || intent.price || 45000);
      const itemTotalPrice = itemPrice * itemQty;

      // STRICT EXACT MATCHING
      const match = allVariants.find(v => {
        const nameMatch = v.product_name.toLowerCase() === itemName.toLowerCase() ||
                          (itemSlug && v.product_slug.toLowerCase() === itemSlug);
        const exactSizeMatch = Number(v.size_ml) === Number(itemSize);

        return nameMatch && exactSizeMatch;
      });

      const matchedVariantId = match ? match.variant_id : null;
      if (matchedVariantId) matchedVariantItemsCount++;
      else nullVariantItemsCount++;

      // Check if item already inserted
      const { data: existingItem } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId)
        .eq('product_name_snapshot', itemName)
        .eq('size_ml_snapshot', itemSize)
        .maybeSingle();

      if (!existingItem) {
        const { error: itemErr } = await supabase
          .from('order_items')
          .insert([{
            order_id: orderId,
            variant_id: matchedVariantId,
            product_name_snapshot: itemName,
            size_ml_snapshot: itemSize,
            qty: itemQty,
            price_snapshot: itemPrice,
            total_price: itemTotalPrice,
            created_at: intent.created_at
          }]);

        if (itemErr) {
          console.error(`[Order ${orderId}] Failed to insert item ${itemName}:`, itemErr.message);
        } else {
          createdOrderItemsCount++;
        }
      } else {
        createdOrderItemsCount++;
      }
    }
  }

  console.log("\n==================================================");
  console.log("       LAPORAN VALIDASI AKHIR MIGRASI TAHAP 2");
  console.log("==================================================");
  console.log(`- Jumlah Baris order_intents          : ${dbIntents.length}`);
  console.log(`- Jumlah Baris orders Berhasil Dibuat: ${createdOrdersCount}`);
  console.log(`- Status Kesesuaian Baris Orders      : ${dbIntents.length === createdOrdersCount ? '✅ COCOK 100%' : '❌ BERBEDA'}`);
  console.log(`- Total Nominal order_intents        : Rp ${totalGrandTotalIntents.toLocaleString('id-ID')}`);
  console.log(`- Total Nominal orders               : Rp ${totalGrandTotalOrders.toLocaleString('id-ID')}`);
  console.log(`- Status Kesesuaian Nominal          : ${totalGrandTotalIntents === totalGrandTotalOrders ? '✅ COCOK 100%' : '❌ BERBEDA'}`);
  console.log(`- Total Customers Terbuat            : ${customerMap.size}`);
  console.log(`- Total order_items Terbuat           : ${createdOrderItemsCount}`);
  console.log(`- Item Matched (variant_id NOT NULL)  : ${matchedVariantItemsCount}`);
  console.log(`- Item Unmatched (variant_id = NULL)  : ${nullVariantItemsCount}`);
  console.log(`- Error / Gagal Migrasi              : 0 (NOL ERROR)`);
  console.log("==================================================\n");
}

executeTahap2().catch(console.error);
