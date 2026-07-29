"use client";

import ProductGrid from "./ProductGrid";
import { ProductWithVariants, Category } from "@/lib/supabase";

interface ProductCatalogSectionProps {
  products: ProductWithVariants[];
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (catId: string) => void;
}

export default function ProductCatalogSection({
  products,
  categories,
  selectedCategoryId,
  onSelectCategory,
}: ProductCatalogSectionProps) {
  const isAllOrBestSeller = selectedCategoryId === "all";
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const sectionTitle = isAllOrBestSeller
    ? "Best Seller"
    : selectedCategory?.name || "Best Seller";

  // Filter products based on selected category or size
  const filteredProducts = products.filter((product) => {
    if (isAllOrBestSeller) return true;

    // Match by direct category_id
    if (product.category_id && product.category_id === selectedCategoryId) {
      return true;
    }

    // Fallback match by category slug or variant size_ml
    if (!selectedCategory) return true;

    const slugLower = selectedCategory.slug.toLowerCase();
    const nameLower = selectedCategory.name.toLowerCase();

    if (slugLower.includes("30") || nameLower.includes("30")) {
      return product.product_variants?.some((v) => v.size_ml === 30 || v.size_ml === 35);
    }
    if (slugLower.includes("50") || nameLower.includes("50")) {
      return product.product_variants?.some((v) => v.size_ml === 50);
    }
    if (slugLower.includes("100") || nameLower.includes("100")) {
      return product.product_variants?.some((v) => v.size_ml === 100);
    }
    if (slugLower.includes("sample") || nameLower.includes("sample")) {
      return product.product_variants?.some((v) => v.size_ml <= 20);
    }

    return true;
  });

  return (
    <section id="koleksi" className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-10 md:pt-16 pb-6 scroll-mt-20 bg-brandWhite font-sans">
      <div className="text-center mb-8 md:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-brandBlack tracking-tight font-sans">
          {sectionTitle}
        </h2>
        {!isAllOrBestSeller && (
          <button
            onClick={() => onSelectCategory("all")}
            className="mt-3 inline-block text-xs font-semibold text-neutral-500 hover:text-black underline underline-offset-4 font-sans transition-colors cursor-pointer"
          >
            ← Kembali ke Best Seller
          </button>
        )}
      </div>

      <ProductGrid products={filteredProducts} />
    </section>
  );
}
