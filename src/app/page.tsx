import { supabase } from "@/lib/supabase";
import ProductGrid, { ProductGridSkeleton } from "@/components/ProductGrid";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";

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

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack">
      <Navbar />
      <main className="flex-grow">
        {/* Full-screen Hero Section */}
        <section className="relative min-h-screen flex flex-col justify-center items-center px-6 text-center bg-brandWhite overflow-hidden">
          <div className="relative z-10 space-y-6 max-w-4xl -mt-16 flex flex-col items-center animate-slide-up">
            <Image
              src="/logo.png"
              alt="Al Parfume"  
              width={180}
              height={60}
              className="h-14 w-auto object-contain mx-auto mb-6 logo-img"
              priority
            />

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-brandBlack leading-tight tracking-tight max-w-3xl mx-auto">
                Sebuah aroma untuk setiap momen sebuah kenangan untuk setiap aroma
              </h1>
              <p className="text-base text-neutral-500 font-normal max-w-md mx-auto leading-relaxed">
                Temukan aroma yang mencerminkan siapa dirimu.
              </p>
            </div>
            
            <div className="pt-4">
              <Link
                href="#koleksi"
                className="inline-block bg-brandBlack text-brandWhite text-sm font-medium px-8 py-3.5 rounded-full hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-sm"
              >
                Jelajahi Koleksi
              </Link>
            </div>
          </div>

          {/* Scroll Indicator */}
          <Link 
            href="#koleksi" 
            className="absolute bottom-12 flex flex-col items-center gap-2 text-neutral-400 hover:text-brandBlack transition-colors duration-300 animate-pulse"
          >
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </Link>
        </section>

        {/* Product Grid Section */}
        <section id="koleksi" className="max-w-6xl mx-auto px-6 py-24 md:py-32 scroll-mt-20 bg-brandWhite">

          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductGrid products={products} />
          </Suspense>
        </section>

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
