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

async function runStrictDryRun() {
  console.log("==================================================");
  console.log("   TAHAP 2: DRY RUN MIGRASI (STRICT EXACT MATCHING)");
  console.log("==================================================");

  // 1. Fetch products & product_variants
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

  const uniqueCustomers = new Map();
  const previewOrders = [];
  const unmatchedItemsList = [];
  const matchedItemsList = [];

  let totalOrderItemsCount = 0;
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;
  let totalGrandTotalSum = 0;

  dbIntents.forEach((intent, idx) => {
    const wa = (intent.customer_wa || '').trim();
    const name = (intent.customer_name || '').trim();
    const custKey = `${wa}_${name}`;

    if (!uniqueCustomers.has(custKey)) {
      uniqueCustomers.set(custKey, { name, wa_number: wa, address: intent.customer_address });
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
        console.warn(`[Order #${idx+1}] Failed to parse items_json:`, err.message);
      }
    }

    // Fallback if items array empty
    if (rawItems.length === 0) {
      rawItems = [{
        productName: intent.product_name || 'Produk Parfum',
        sizeMl: intent.size_ml || 35,
        quantity: 1,
        price: intent.price || intent.grand_total || 45000
      }];
    }

    // Process items & STRICT EXACT MATCHING
    const itemsPreview = rawItems.map(item => {
      totalOrderItemsCount++;

      const itemName = String(item.productName || item.name || intent.product_name || '').trim();
      const itemSlug = String(item.productSlug || item.slug || '').trim().toLowerCase();
      const itemSize = Number(item.sizeMl || item.size_ml || intent.size_ml || 35);
      const itemQty = Math.max(1, Number(item.quantity || item.qty || 1));
      const itemPrice = Number(item.price || intent.price || 45000);
      const itemTotalPrice = itemPrice * itemQty;

      // STRICT MATCHING RULE:
      // Match ONLY if (product_name == name OR slug == slug) AND size_ml EXACTLY MATCHES (e.g. 35ml == 35ml)
      const match = allVariants.find(v => {
        const nameMatch = v.product_name.toLowerCase() === itemName.toLowerCase() ||
                          (itemSlug && v.product_slug.toLowerCase() === itemSlug);
        const exactSizeMatch = Number(v.size_ml) === Number(itemSize);

        return nameMatch && exactSizeMatch;
      });

      let matchedVariantId = null;
      if (match) {
        matchedVariantId = match.variant_id;
        matchedItemsCount++;
        matchedItemsList.push({
          order_intent_id: intent.id,
          customer_name: name,
          product_name_snapshot: itemName,
          size_ml_snapshot: itemSize,
          variant_id: matchedVariantId,
          db_variant_name: `${match.product_name} (${match.size_ml}ml)`
        });
      } else {
        unmatchedItemsCount++;
        unmatchedItemsList.push({
          order_intent_id: intent.id,
          created_at: intent.created_at,
          customer_name: name,
          product_name_snapshot: itemName,
          size_ml_snapshot: itemSize,
          price_snapshot: itemPrice,
          reason: `Ukuran ${itemSize}ml di data lama tidak cocok dengan varian aktif di catalog (semua varian botol di catalog saat ini berukuran 30ml). variant_id diset NULL, snapshot histori (${itemName} ${itemSize}ml Rp${itemPrice.toLocaleString('id-ID')}) tetap 100% utuh.`
        });
      }

      return {
        variant_id: matchedVariantId,
        product_name_snapshot: itemName,
        size_ml_snapshot: itemSize,
        qty: itemQty,
        price_snapshot: itemPrice,
        total_price: itemTotalPrice,
        is_matched: matchedVariantId !== null,
        matched_variant_name: match ? `${match.product_name} (${match.size_ml}ml)` : null
      };
    });

    const calculatedGrandTotal = Number(intent.grand_total || intent.total_price || intent.price || 0);
    totalGrandTotalSum += calculatedGrandTotal;

    const deliveryMethod = intent.customer_address?.toLowerCase().includes('ambil di toko') || parsedMeta.delivery_method === 'pickup' ? 'pickup' : 'courier';

    previewOrders.push({
      intent_id: intent.id,
      order_code: intent.order_code || `ORD-HIST-${intent.id.slice(0, 8)}`,
      customer_name: name,
      customer_wa: wa,
      delivery_method: deliveryMethod,
      shipping_cost: Number(intent.shipping_cost || parsedMeta.shipping_cost || (deliveryMethod === 'courier' ? 14000 : 0)),
      grand_total: calculatedGrandTotal,
      payment_status: intent.payment_status || 'pending_verification',
      fulfillment_status: intent.fulfillment_status || 'pending',
      items: itemsPreview
    });
  });

  const report = {
    dry_run_date: new Date().toISOString(),
    matching_mode: "STRICT_EXACT_MATCHING",
    summary: {
      total_order_intents: dbIntents.length,
      total_orders_to_create: previewOrders.length,
      total_unique_customers_to_create: uniqueCustomers.size,
      total_order_items_to_create: totalOrderItemsCount,
      total_items_matched_strictly: matchedItemsCount,
      total_items_unmatched_strictly: unmatchedItemsCount,
      strict_match_percentage: `${((matchedItemsCount / totalOrderItemsCount) * 100).toFixed(1)}%`,
      total_grand_total_sum: totalGrandTotalSum
    },
    matched_items_detail: matchedItemsList,
    unmatched_items_detail: unmatchedItemsList,
    preview_orders: previewOrders
  };

  const reportPath = path.join(__dirname, '..', 'scratch', 'tahap2_strict_dry_run_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log("==================================================");
  console.log("    RINGKASAN DRY RUN (STRICT EXACT MATCHING)");
  console.log("==================================================");
  console.log(`- Total Baris order_intents     : ${report.summary.total_order_intents}`);
  console.log(`- Total Orders yang akan dibuat : ${report.summary.total_orders_to_create}`);
  console.log(`- Total Pelanggan Unik          : ${report.summary.total_unique_customers_to_create}`);
  console.log(`- Total Items Pesanan           : ${report.summary.total_order_items_to_create}`);
  console.log(`- Items Matched Persis (FK OK)  : ${report.summary.total_items_matched_strictly} (${report.summary.strict_match_percentage})`);
  console.log(`- Items Gagal Match (FK NULL)   : ${report.summary.total_items_unmatched_strictly}`);
  console.log(`- Total Nominal Grand Total     : Rp ${totalGrandTotalSum.toLocaleString('id-ID')}`);
  console.log("==================================================\n");

}

runStrictDryRun().catch(console.error);
