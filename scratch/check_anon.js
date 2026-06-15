const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Read .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const config = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || "";
    if (value.trim().startsWith('"') && value.trim().endsWith('"')) {
      value = value.trim().slice(1, -1);
    }
    config[key] = value.trim();
  }
});

const supabaseUrl = config.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = config.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing Supabase config in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

async function checkAnon() {
  console.log("Querying order_intents table using ANON key...");
  const { data, error } = await supabase.from("order_intents").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching order_intents with ANON key:", error);
  } else {
    console.log(`ANON query success! Found ${data.length} orders:`);
    console.dir(data, { depth: null });
  }
}

checkAnon();
