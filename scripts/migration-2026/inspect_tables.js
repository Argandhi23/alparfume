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

async function inspectAllTables() {
  const targetTables = [
    'categories', 'products', 'product_variants', 'customers',
    'orders', 'order_items', 'payment_proofs', 'order_status_log',
    'stock_movements', 'order_intents'
  ];

  console.log("=== INSPEKSI TABEL SUPABASE LIVE ===");
  const statusMap = {};

  for (const table of targetTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      statusMap[table] = { status: "BELUM ADA / ERROR", message: error.message };
    } else {
      statusMap[table] = { status: "SUDAH ADA", rowCount: data.length };
    }
  }

  console.log(JSON.stringify(statusMap, null, 2));
}

inspectAllTables().catch(console.error);
