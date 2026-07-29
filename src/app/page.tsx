import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomePageClient from "@/components/HomePageClient";

export const revalidate = 0;

async function getProducts() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("is_active", true)
      .order("is_sold_out", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }

    return data || [];
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
