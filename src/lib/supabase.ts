import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  bg_color: string;
  sort_order: number;
  created_at?: string;
}

export interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  notes?: string;
  top_notes?: string | null;
  middle_notes?: string | null;
  bottom_notes?: string | null;
  image_url: string | null;
  category_id?: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  is_low_stock?: boolean;
  is_best_seller?: boolean;
  stock: number;
  shopee_link?: string | null;
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
  category?: Category | null;
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
  payment_method?: "qris" | "cod_pickup" | string;
  payment_status?: "pending_verification" | "paid" | "cancelled" | string;
  fulfillment_status?: "pending" | "processing" | "shipped" | "ready_for_pickup" | "completed" | string;
  payment_proof_url?: string | null;
  courier_name?: string | null;
  shipping_cost?: number;
  tracking_number?: string | null;
  destination_city?: string | null;
  delivery_method?: string | null;
  subtotal?: number;
  total_price?: number;
  order_code?: string | null;
  created_at: string;
}
