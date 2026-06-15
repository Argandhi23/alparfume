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

async function check() {
  const { data, error } = await supabase.from("products").select("id, name, slug, image_url");
  if (error) {
    console.error("Error fetching products:", error);
  } else {
    console.log("Current Products in DB:");
    data.forEach((p) => {
      console.log(`- ID: ${p.id}, Name: ${p.name}, Slug: ${p.slug}, ImageUrl: ${p.image_url}`);
    });
  }
}

check();
