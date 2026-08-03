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

async function inspectDbVariants() {
  const { data: products } = await supabase.from('products').select('*, product_variants(*)');
  console.log("=== DB PRODUCTS AND VARIANTS ===");
  products.forEach(p => {
    console.log(`Product: ${p.name} (slug: ${p.slug})`);
    if (p.product_variants && p.product_variants.length > 0) {
      p.product_variants.forEach(v => {
        console.log(`  - Variant ID: ${v.id} | Size: ${v.size_ml}ml | Price: Rp ${v.price}`);
      });
    } else {
      console.log(`  - No variants found!`);
    }
  });
}

inspectDbVariants().catch(console.error);
