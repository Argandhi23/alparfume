import { cache } from "react";
import { supabase, ProductWithVariants } from "@/lib/supabase";
import ProductGrid, { ProductGridSkeleton } from "@/components/ProductGrid";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const getCategoryData = cache(async (slug: string) => {
  try {
    // 1. Fetch category by slug
    const { data: category } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!category) {
      return { category: null, products: [] };
    }

    // 2. Fetch active products strictly filtered by category_id in Supabase
    const { data: initialProducts, error: prodError } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("is_active", true)
      .eq("category_id", category.id)
      .order("is_sold_out", { ascending: true })
      .order("created_at", { ascending: false });

    let products: ProductWithVariants[] = (initialProducts as unknown as ProductWithVariants[]) || [];

    // Fallback if no products found with explicit category_id
    if (products.length === 0 && !prodError) {
      const { data: allProds } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .eq("is_active", true)
        .order("is_sold_out", { ascending: true })
        .order("created_at", { ascending: false });

      if (allProds) {
        const slugLower = category.slug.toLowerCase();
        const nameLower = category.name.toLowerCase();
        products = (allProds as unknown as ProductWithVariants[]).filter((p) => {
          if (p.category_id === category.id) return true;
          if (slugLower.includes("sample") || nameLower.includes("sample")) {
            return p.name.toLowerCase().includes("sample") || p.product_variants?.some((v) => v.size_ml <= 20);
          }
          if (slugLower.includes("toilette") || nameLower.includes("toilette")) {
            return p.product_variants?.some((v) => v.size_ml === 30);
          }
          return false;
        });
      }
    }

    if (prodError) {
      console.error("Error fetching category products:", prodError);
      return { category, products: [] };
    }

    return {
      category,
      products: (products as ProductWithVariants[]) || [],
    };
  } catch (err) {
    console.error("Error fetching category page data:", err);
    return { category: null, products: [] };
  }
});

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { category } = await getCategoryData(slug);
  const titleName = category ? category.name : slug;

  return {
    title: `Kategori ${titleName} | Al Parfume`,
    description: `Jelajahi koleksi parfum ${titleName} eksklusif dari AL PARFUME.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { category, products } = await getCategoryData(slug);

  if (!category) {
    notFound();
  }

  const availableProducts = products.filter(
    (p) => !p.is_sold_out && (p.stock === null || p.stock === undefined || p.stock > 0)
  );

  const soldOutProducts = products.filter(
    (p) => p.is_sold_out || (p.stock !== null && p.stock !== undefined && p.stock <= 0)
  );

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack font-sans">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-16 w-full">
        {/* Navigation Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        {/* Category Page Title */}
        <div className="text-center mb-12 space-y-2">
          <span className="text-xs uppercase tracking-[0.25em] text-neutral-400 font-semibold font-sans block">
            Katalog Kategori
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-brandBlack tracking-tight font-sans capitalize">
            {category.name}
          </h1>
          <p className="text-sm text-neutral-500 max-w-md mx-auto">
            Temukan koleksi aroma eksklusif untuk kategori {category.name}.
          </p>
        </div>

        {/* Available Products Grid */}
        <div className="mb-16">
          <Suspense fallback={<ProductGridSkeleton />}>
            <ProductGrid products={availableProducts} />
          </Suspense>
        </div>

        {/* Sold Out Section for this Category */}
        {soldOutProducts.length > 0 && (
          <>
            <div className="my-12 relative flex items-center justify-center">
              <div className="w-full border-t border-neutral-200" />
              <span className="absolute bg-brandWhite px-6 text-sm font-bold tracking-[0.2em] text-neutral-400 uppercase font-sans">
                Stok Habis
              </span>
            </div>
            <div className="pb-12">
              <Suspense fallback={<ProductGridSkeleton />}>
                <ProductGrid products={soldOutProducts} />
              </Suspense>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
