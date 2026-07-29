"use client";

import { useState } from "react";
import HeroSlider from "./HeroSlider";
import CategoryGrid from "./CategoryGrid";
import ProductGrid from "./ProductGrid";
import { ProductWithVariants, Category, Banner } from "@/lib/supabase";
import { Search, X } from "lucide-react";

interface HomePageClientProps {
  products: ProductWithVariants[];
  categories: Category[];
  banners: Banner[];
}

export default function HomePageClient({ products, categories, banners }: HomePageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Separate available and sold-out products
  const availableProducts = products.filter(
    (p) => !p.is_sold_out && (p.stock === null || p.stock === undefined || p.stock > 0)
  );

  // Filter products live by query (includes both available and sold-out products)
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredProducts = normalizedQuery
    ? products.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(normalizedQuery);
        const descMatch = (p.description || "").toLowerCase().includes(normalizedQuery);
        const notesMatch = (p.notes || "").toLowerCase().includes(normalizedQuery);
        const topNotesMatch = (p.top_notes || "").toLowerCase().includes(normalizedQuery);
        const variantMatch = p.product_variants?.some((v) =>
          `${v.size_ml}ml ${v.price}`.toLowerCase().includes(normalizedQuery)
        );
        return nameMatch || descMatch || notesMatch || topNotesMatch || variantMatch;
      })
    : availableProducts;

  // Best Seller filtering: Show products explicitly flagged as Best Seller in Admin.
  // Fallback to all available products if no products are flagged as Best Seller yet.
  const bestSellerFlagged = filteredProducts.filter((p) => p.is_best_seller === true);
  const displayProducts = normalizedQuery
    ? filteredProducts
    : bestSellerFlagged.length > 0
    ? bestSellerFlagged
    : availableProducts;

  const soldOutProducts = products.filter(
    (p) => p.is_sold_out || (p.stock !== null && p.stock !== undefined && p.stock <= 0)
  );

  return (
    <>
      {/* Top Hero Banner Slider */}
      <HeroSlider banners={banners} />

      {/* Category Grid Section (Links to /categories/[slug]) */}
      <CategoryGrid categories={categories} />

      {/* Best Seller & Catalog Section */}
      <section id="koleksi" className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-10 md:pt-16 pb-6 scroll-mt-20 bg-brandWhite font-sans">
        <div className="flex flex-col items-center justify-center space-y-4 mb-8 md:mb-12 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-brandBlack tracking-tight font-sans">
            {normalizedQuery ? "Hasil Pencarian" : "Best Seller"}
          </h2>

          {/* Instant Search Bar */}
          <div className="relative w-full max-w-md mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-neutral-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari parfum..."
                className="w-full bg-white border border-neutral-200 focus:border-black rounded-full pl-11 pr-10 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:outline-none transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 p-1 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors"
                  aria-label="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {normalizedQuery && (
              <p className="text-[11px] text-neutral-500 mt-2 font-medium">
                Ditemukan <span className="font-bold text-black">{displayProducts.length}</span> parfum yang cocok
              </p>
            )}
          </div>
        </div>

        {displayProducts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-3xl bg-neutral-50/50 space-y-3 font-sans max-w-md mx-auto">
            <p className="text-sm font-bold text-neutral-800">Parfum tidak ditemukan</p>
            <p className="text-xs text-neutral-500">
              Tidak ada hasil untuk &quot;<span className="font-semibold text-black">{searchQuery}</span>&quot;.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs bg-black text-white px-4 py-2 rounded-full font-bold hover:bg-neutral-800 transition-colors"
            >
              Lihat Semua Parfum
            </button>
          </div>
        ) : (
          <ProductGrid products={displayProducts} />
        )}
      </section>

      {/* Separator / Sekat Stok Habis */}
      {!normalizedQuery && soldOutProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 my-12 md:my-20 font-sans">
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-neutral-200" />
            <span className="absolute bg-brandWhite px-6 text-sm font-bold tracking-[0.2em] text-neutral-400 uppercase font-sans">
              Stok Habis
            </span>
          </div>
        </div>
      )}

      {/* Stok Habis Section */}
      {!normalizedQuery && soldOutProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pb-16 md:pb-24 bg-brandWhite font-sans">
          <ProductGrid products={soldOutProducts} />
        </section>
      )}
    </>
  );
}
