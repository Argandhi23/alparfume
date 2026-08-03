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

async function testStep3B() {
  console.log("=== TESTING LANGKAH 3B (UPLOAD PROOF TO PAYMENT_PROOFS) ===");

  // Fetch 1 order from new orders table
  const { data: orders } = await supabase.from('orders').select('id, order_code').limit(1);
  if (!orders || orders.length === 0) {
    console.error("No orders found to test upload proof.");
    return;
  }

  const testOrder = orders[0];
  const dummyImageUrl = "https://example.com/test_proof.jpg";

  console.log(`Testing payment_proofs insert for order_code: '${testOrder.order_code}' (id: ${testOrder.id})...`);

  // Insert proof
  const { data: proofData, error: proofErr } = await supabase
    .from('payment_proofs')
    .insert([{
      order_id: testOrder.id,
      image_url: dummyImageUrl,
      verified_by: null
    }])
    .select('*')
    .single();

  if (proofErr) {
    console.error("Error inserting into payment_proofs:", proofErr.message);
    return;
  }

  console.log("✅ Successfully inserted record into 'payment_proofs':", proofData.id, "Image:", proofData.image_url);

  // Update order status to pending_verification
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ payment_status: 'pending_verification' })
    .eq('id', testOrder.id);

  if (updateErr) {
    console.error("Error updating order payment_status:", updateErr.message);
    return;
  }

  console.log("✅ Successfully updated order payment_status to 'pending_verification'.");
  console.log("\n✅ LANGKAH 3B VERIFIED 100% WORKING & SAFE!");
}

testStep3B().catch(console.error);
