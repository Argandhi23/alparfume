import { supabase, ProductWithVariants, Testimonial } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomePageClient from "@/components/HomePageClient";
import { getLocalTestimonials } from "@/lib/testimonialsHelper";

export const revalidate = 300;

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

async function getTestimonials(): Promise<Testimonial[]> {
  try {
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, customer_name, rating, product_id, product_name_override, review_text, tag, image_url, is_verified_buyer, is_active, sort_order, created_at, products(id, name, slug, image_url)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data as unknown as Testimonial[];
    }
  } catch (err) {
    console.warn("Notice: Fetching testimonials from local fallback:", err);
  }

  const local = getLocalTestimonials();
  return local.filter((t) => t.is_active !== false);
}

export default async function Home() {
  const [products, categories, banners, testimonials] = await Promise.all([
    getProducts(),
    getCategories(),
    getBanners(),
    getTestimonials(),
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack font-sans">
      <Navbar />
      <main className="flex-grow">
        <HomePageClient
          products={products}
          categories={categories}
          banners={banners}
          testimonials={testimonials}
        />
      </main>
      <Footer />
    </div>
  );
}
