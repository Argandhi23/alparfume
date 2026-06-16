import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  notes: string; // Stored as raw text or JSON string containing {"top": "...", "middle": "...", "bottom": "..."}
  image_url: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: string;
  size_ml: number;
  price: number;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
}

export interface OrderIntent {
  id: number;
  product_name: string;
  size_ml: number;
  price: number;
  customer_name?: string | null;
  customer_wa?: string | null;
  customer_address?: string | null;
  order_notes?: string | null;
  items_json?: string | null;
  created_at: string;
}
