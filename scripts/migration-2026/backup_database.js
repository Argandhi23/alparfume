/**
 * ⚠️ SCRIPT MIGRASI / TEST SATU KALI PAKAI — SUDAH DIJALANKAN PADA 02 AGUSTUS 2026
 * JANGAN DIJALANKAN ULANG SECARA SEMBARANGAN DI PRODUCTION.
 * Dapat menyebabkan duplikasi data atau pengujian ulang jika di-run kembali.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if present
const envPath = path.join(__dirname, '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Error: Missing Supabase URL or Key in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runBackup() {
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dataBackupPath = path.join(backupDir, `pre_migration_data_${timestamp}.json`);
  const sqlBackupPath = path.join(backupDir, `pre_migration_restore_${timestamp}.sql`);

  console.log(`Starting Supabase database backup to ${backupDir}...`);

  const tablesToBackup = ['products', 'product_variants', 'order_intents', 'categories', 'banners'];
  const fullBackup = {
    backup_date: new Date().toISOString(),
    tables: {}
  };

  let sqlDump = `-- AL PARFUME PRE-MIGRATION LOGICAL BACKUP DUMP\n-- Date: ${new Date().toISOString()}\n\n`;

  for (const table of tablesToBackup) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`Table '${table}' query warning: ${error.message}`);
        fullBackup.tables[table] = { error: error.message, data: [] };
      } else {
        console.log(`Backed up '${table}': ${data ? data.length : 0} rows.`);
        fullBackup.tables[table] = { count: data ? data.length : 0, data: data || [] };

        if (data && data.length > 0) {
          sqlDump += `-- Backup for table: ${table}\n`;
          data.forEach(row => {
            const keys = Object.keys(row);
            const columns = keys.map(k => `"${k}"`).join(', ');
            const values = keys.map(k => {
              const val = row[k];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number' || typeof val === 'boolean') return val;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return `'${String(val).replace(/'/g, "''")}'`;
            }).join(', ');
            sqlDump += `INSERT INTO "${table}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
          });
          sqlDump += `\n`;
        }
      }
    } catch (err) {
      console.warn(`Skipping table '${table}': ${err.message}`);
    }
  }

  // Save JSON data dump
  fs.writeFileSync(dataBackupPath, JSON.stringify(fullBackup, null, 2), 'utf8');
  console.log(`Saved JSON backup to: ${dataBackupPath}`);

  // Save SQL restore script
  fs.writeFileSync(sqlBackupPath, sqlDump, 'utf8');
  console.log(`Saved SQL restore script to: ${sqlBackupPath}`);

  console.log("\n--- BACKUP SUMMARY ---");
  Object.keys(fullBackup.tables).forEach(tbl => {
    const info = fullBackup.tables[tbl];
    console.log(`- ${tbl}: ${info.count !== undefined ? info.count + ' rows' : 'Error/Missing'}`);
  });

  return { dataBackupPath, sqlBackupPath, fullBackup };
}

runBackup().catch(err => {
  console.error("Backup failed:", err);
  process.exit(1);
});
