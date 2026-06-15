import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// 1. Restore WhatsApp number in .env.local
console.log("Restoring WhatsApp number in .env.local...");
let envContent = fs.readFileSync(".env.local", "utf8");

// We want to replace NEXT_PUBLIC_WA_NUMBER=6285806912873 with NEXT_PUBLIC_WA_NUMBER=6281915931190
envContent = envContent.replace(
  /NEXT_PUBLIC_WA_NUMBER=.*/g,
  "NEXT_PUBLIC_WA_NUMBER=6281915931190"
);

fs.writeFileSync(".env.local", envContent, "utf8");
console.log(".env.local updated successfully!");

// 2. Parse env values for Supabase client
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

async function restore() {
  console.log("Restoring Guavin images in database...");
  const originalImages = JSON.stringify([
    "/images/products/guavin_1.png",
    "/images/products/guavin_2.png",
    "/images/products/guavin_3.png"
  ]);

  const { error } = await supabase
    .from("products")
    .update({ image_url: originalImages })
    .eq("slug", "guavin");

  if (error) {
    console.error("Error updating Guavin images:", error);
  } else {
    console.log("Guavin images restored successfully in database!");
  }
}

restore();
