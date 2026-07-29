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

        {/* Brand Story Section */}
        <section id="tentang" className="bg-[var(--background)] py-24 md:py-32">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left side */}
            <div className="space-y-6 text-left">
              <div className="space-y-2">
                <span className="text-xs tracking-[0.3em] text-[var(--text-muted)] uppercase font-sans font-semibold block">
                  TENTANG KAMI
                </span>
                <h3 className="font-plus-jakarta text-3xl font-bold text-[var(--foreground)] leading-tight">
                  Al Parfume
                </h3>
              </div>
              
              <p className="font-sans text-base text-[var(--foreground)]/80 leading-relaxed font-normal">
                Kami percaya bahwa aroma adalah bahasa yang paling jujur. Al Parfume hadir untuk membantu kamu menemukan wangi yang benar-benar kamu — bukan sekadar parfum, tapi identitas yang kamu kenakan setiap hari.
              </p>
            </div>
            
            {/* Right side: generous whitespace */}
            <div className="hidden md:block"></div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
