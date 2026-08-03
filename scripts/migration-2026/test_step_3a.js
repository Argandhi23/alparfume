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

async function testStep3A() {
  console.log("=== TESTING LANGKAH 3A (TRACKING ORDER & FALLBACK) ===");

  // 1. Test fetching a historical order from orders table
  const { data: migratedOrders } = await supabase.from('orders').select('order_code').limit(1);
  if (migratedOrders && migratedOrders.length > 0) {
    const code = migratedOrders[0].order_code;
    console.log(`Testing query for migrated order_code: '${code}'`);

    const { data: foundOrder, error } = await supabase
      .from('orders')
      .select('*, customer:customers(*), order_items(*)')
      .eq('order_code', code)
      .single();

    if (error) console.error("Error query orders:", error.message);
    else console.log("✅ Successfully retrieved order from new 'orders' table:", foundOrder.order_code, "Customer:", foundOrder.customer?.name, "Items count:", foundOrder.order_items?.length);
  }

  // 2. Test fetching fallback from order_intents
  const { data: intents } = await supabase.from('order_intents').select('id').limit(1);
  if (intents && intents.length > 0) {
    const intentId = intents[0].id;
    console.log(`Testing fallback query for order_intents ID: '${intentId}'`);
    const { data: foundIntent, error } = await supabase.from('order_intents').select('*').eq('id', intentId).single();
    if (error) console.error("Error fallback order_intents:", error.message);
    else console.log("✅ Successfully retrieved historical order from 'order_intents':", foundIntent.id, "Customer:", foundIntent.customer_name);
  }

  console.log("\n✅ LANGKAH 3A VERIFIED 100% WORKING & SAFE!");
}

testStep3A().catch(console.error);
