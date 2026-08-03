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

async function testUploadProofEndpoint() {
  console.log("=== TESTING END-TO-END UPLOAD PROOF API ROUTE ===");

  // 1. Get an existing order code from orders table
  const { data: orders } = await supabase.from('orders').select('id, order_code').limit(1);
  if (!orders || orders.length === 0) {
    console.error("No orders found to test.");
    return;
  }

  const testOrder = orders[0];
  console.log(`Testing HTTP API payload for order_code: '${testOrder.order_code}' (id: ${testOrder.id})...`);

  // Create a valid 1x1 pixel JPEG Base64 string
  const dummyBase64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP______________________________________________________________________________________wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  // Import the POST handler directly from route.ts
  // Simulate NextRequest
  const { POST } = require('../../src/app/api/orders/upload-proof/route.ts');
  const { NextRequest } = require('next/server');

  const req = new NextRequest("http://localhost:3000/api/orders/upload-proof", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1"
    },
    body: JSON.stringify({
      orderId: testOrder.order_code,
      proofUrl: dummyBase64Image
    })
  });

  const response = await POST(req);
  const jsonResult = await response.json();

  console.log("API Response Status:", response.status);
  console.log("API Response Payload:", JSON.stringify(jsonResult, null, 2));

  if (response.status === 200 && jsonResult.success) {
    console.log("✅ HTTP Route Test SUCCESSFUL! Image uploaded and saved to payment_proofs.");

    // Verify database record in payment_proofs
    const { data: proofs, error } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('order_id', testOrder.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && proofs && proofs.length > 0) {
      console.log("✅ Verified record in 'payment_proofs' table:", proofs[0].id, "Image URL:", proofs[0].image_url.slice(0, 60) + "...");
    }
  } else {
    console.error("❌ API Route Test Failed:", jsonResult);
  }
}

testUploadProofEndpoint().catch(console.error);
