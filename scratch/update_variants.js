import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Simple env parser
const envContent = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"] || "";
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"] || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Fetching all products...");
  const { data: products, error: prodError } = await supabase.from("products").select("id, name");
  if (prodError) {
    console.error("Error fetching products:", prodError);
    return;
  }

  console.log(`Found ${products.length} products. Clearing existing variants and adding 35ml / Rp45.000 for each...`);

  for (const prod of products) {
    console.log(`Updating variants for product: ${prod.name} (${prod.id})`);

    // 1. Delete all variants for this product
    const { error: delError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", prod.id);

    if (delError) {
      console.error(`Error deleting variants for ${prod.name}:`, delError);
      continue;
    }

    // 2. Insert new single variant: 35ml / 45000
    const { error: insError } = await supabase
      .from("product_variants")
      .insert({
        product_id: prod.id,
        size_ml: 35,
        price: 45000
      });

    if (insError) {
      console.error(`Error inserting variant for ${prod.name}:`, insError);
    } else {
      console.log(`Successfully updated ${prod.name} to 35ml / Rp45.000.`);
    }
  }

  console.log("Database update completed!");
}

run();
