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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function backupSchema() {
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const schemaBackupPath = path.join(backupDir, `pre_migration_schema_structure_${timestamp}.json`);

  const tables = ['products', 'product_variants', 'order_intents', 'categories', 'banners'];
  const schemaInfo = {};

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error && data && data.length > 0) {
      const sample = data[0];
      schemaInfo[table] = Object.keys(sample).map(key => ({
        column_name: key,
        sample_type: typeof sample[key],
        sample_value: sample[key]
      }));
    } else {
      schemaInfo[table] = { note: "Empty or unreachable", error: error?.message };
    }
  }

  fs.writeFileSync(schemaBackupPath, JSON.stringify(schemaInfo, null, 2), 'utf8');
  console.log(`Saved schema structure to: ${schemaBackupPath}`);
}

backupSchema().catch(console.error);
