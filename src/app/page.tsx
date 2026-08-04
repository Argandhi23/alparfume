import { supabase, ProductWithVariants } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomePageClient from "@/components/HomePageClient";

export const revalidate = 60;

async function getProducts() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, description, notes, image_url, category_id, is_active, is_sold_out, is_low_stock, is_best_seller, stock, created_at, product_variants(id, product_id, size_ml, price, stock)")
      .eq("is_active", true)
      .order("is_sold_out", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }

    return (data as unknown as ProductWithVariants[]) || [];
  } catch (err) {
    console.error("Unexpected error fetching products:", err);
    return [];
  }
}

async function getCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Unexpected error fetching categories:", err);
    return [];
  }
}

async function getBanners() {
  try {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching banners:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Unexpected error fetching banners:", err);
    return [];
  }
}

export default async function Home() {
  const [products, categories, banners] = await Promise.all([
    getProducts(),
    getCategories(),
    getBanners(),
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack font-sans">
      <Navbar />
      <main className="flex-grow">
        <HomePageClient
          products={products}
          categories={categories}
          banners={banners}
        />
      </main>
      <Footer />
    </div>
  );
}
