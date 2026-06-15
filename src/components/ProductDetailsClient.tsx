"use client";

import { useState } from "react";
import { ProductWithVariants, ProductVariant } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { useCart } from "@/context/CartContext";
import OrderFormModal from "./OrderFormModal";

interface ProductDetailsClientProps {
  product: ProductWithVariants;
}

export default function ProductDetailsClient({ product }: ProductDetailsClientProps) {
  const sortedVariants = [...(product.product_variants || [])].sort((a, b) => a.size_ml - b.size_ml);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    sortedVariants[0] || null
  );
  const [showToast, setShowToast] = useState(false);
  const [isBeliLangsungOpen, setIsBeliLangsungOpen] = useState(false);
  
  const { addToCart } = useCart();

  // Parse notes JSON or fallback to raw
  let notes: { top?: string; middle?: string; bottom?: string } | null = null;
  if (product.notes) {
    try {
      notes = JSON.parse(product.notes);
    } catch {
      // Notes is plain text
    }
  }

  let firstImageUrl = "/placeholder.jpg";
  if (product.image_url) {
    try {
      const parsed = JSON.parse(product.image_url);
      if (Array.isArray(parsed) && parsed.length > 0) {
        firstImageUrl = parsed[0];
      } else if (typeof parsed === "string") {
        firstImageUrl = parsed;
      }
    } catch {
      firstImageUrl = product.image_url;
    }
  }

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addToCart({
      id: `${product.slug}-${selectedVariant.size_ml}`,
      productName: product.name,
      productSlug: product.slug,
      imageUrl: firstImageUrl,
      sizeMl: selectedVariant.size_ml,
      price: selectedVariant.price,
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-8">
      {/* Product Info Header */}
      <div className="space-y-2">
        <span className="text-xs text-[var(--text-muted)] font-medium tracking-wide font-sans block uppercase">
          Al Parfume Collection
        </span>
        <h1 className="font-plus-jakarta text-3xl font-bold text-brandBlack leading-tight">
          {toTitleCase(product.name)}
        </h1>
        {selectedVariant && (
          <div className="pt-2">
            <span className="text-2xl font-semibold text-brandBlack font-plus-jakarta block">
              {formatRupiah(selectedVariant.price)}
            </span>
          </div>
        )}
      </div>

      <hr className="border-t border-[var(--border)]" />

      {/* Description */}
      <div className="space-y-2">
        <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-sans block">
          Description
        </span>
        <p className="text-sm text-[var(--foreground)]/80 leading-relaxed font-light font-sans">
          {product.description}
        </p>
      </div>

      {/* Notes Section (Elegant Tag Style) */}
      {product.notes && (
        <div className="space-y-3 border-t border-[var(--border)] pt-6">
          <span className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-sans block">
            Aroma Profile
          </span>
          {notes && typeof notes === "object" ? (
            <div className="space-y-3 font-sans text-xs">
              {notes.top && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] w-12 font-medium">Top</span>
                  <span className="bg-[var(--background-secondary)] px-3 py-1.5 text-[var(--foreground)] font-medium font-sans border border-[var(--border)] rounded-full">
                    {notes.top}
                  </span>
                </div>
              )}
              {notes.middle && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] w-12 font-medium">Heart</span>
                  <span className="bg-[var(--background-secondary)] px-3 py-1.5 text-[var(--foreground)] font-medium font-sans border border-[var(--border)] rounded-full">
                    {notes.middle}
                  </span>
                </div>
              )}
              {notes.bottom && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] w-12 font-medium">Base</span>
                  <span className="bg-[var(--background-secondary)] px-3 py-1.5 text-[var(--foreground)] font-medium font-sans border border-[var(--border)] rounded-full">
                    {notes.bottom}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--foreground)]/80 font-sans leading-relaxed">{product.notes}</p>
          )}
        </div>
      )}

      {/* Variant Selector */}
      {sortedVariants.length > 0 && (
        <div className="space-y-3 border-t border-[var(--border)] pt-6">
          <span className="text-xs uppercase tracking-wide text-[var(--text-muted)] block font-sans">
            Pilih Ukuran
          </span>
          <div className="flex flex-wrap gap-3">
            {sortedVariants.map((variant) => {
              const isSelected = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  className={`px-5 py-2.5 border text-xs transition-all duration-200 font-sans font-medium rounded-full ${
                    isSelected
                      ? "bg-brandBlack text-brandWhite border-brandBlack shadow-sm"
                      : "bg-[var(--background)] text-brandBlack border-brandBorder hover:border-[var(--foreground)]/40"
                  }`}
                >
                  {variant.size_ml} ml
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedVariant ? (
        <div className="pt-4 space-y-3">
          <button
            onClick={handleAddToCart}
            className="w-full bg-brandBlack text-brandWhite font-medium text-sm py-3 hover:opacity-90 active:opacity-85 transition-all duration-200 flex items-center justify-center gap-3 rounded-full font-sans"
          >
            Tambah ke Keranjang
          </button>
          
          <button
            onClick={() => setIsBeliLangsungOpen(true)}
            className="w-full border border-brandBlack bg-transparent text-brandBlack font-medium text-sm py-3 hover:bg-brandBlack hover:text-brandWhite transition-colors duration-200 flex items-center justify-center gap-3 rounded-full font-sans"
          >
            Beli Langsung
          </button>
        </div>
      ) : (
        <div className="text-sm text-[var(--text-muted)] py-4 font-light font-sans">
          Hubungi kami untuk informasi ketersediaan ukuran dan harga.
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-brandBlack text-brandWhite border border-brandBorder px-6 py-3 shadow-xl text-xs uppercase tracking-widest font-semibold z-50 animate-fade-in">
          Ditambahkan ke keranjang!
        </div>
      )}

      {/* Beli Langsung Order Modal */}
      {isBeliLangsungOpen && selectedVariant && (
        <OrderFormModal
          isOpen={isBeliLangsungOpen}
          onClose={() => setIsBeliLangsungOpen(false)}
          items={[
            {
              id: `${product.slug}-${selectedVariant.size_ml}`,
              productName: product.name,
              productSlug: product.slug,
              imageUrl: firstImageUrl,
              sizeMl: selectedVariant.size_ml,
              price: selectedVariant.price,
              quantity: 1,
            },
          ]}
          totalPrice={selectedVariant.price}
        />
      )}
    </div>
  );
}
