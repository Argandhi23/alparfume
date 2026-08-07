"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatRupiah } from "@/lib/whatsapp";
import { ProductWithVariants } from "@/lib/supabase";
import { sanitizeImageUrl } from "@/lib/imageHelper";

interface ProductCardProps {
  product: ProductWithVariants;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  const prices = product.product_variants?.map((v) => v.price) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  const isSoldOut = product.is_sold_out || (product.stock !== undefined && product.stock !== null && product.stock <= 0);
  const isLowStock = !isSoldOut && (product.is_low_stock || (product.stock !== undefined && product.stock !== null && product.stock < 5));

  const displayImage = sanitizeImageUrl(product.image_url);

  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Link 
      href={`/products/${product.slug}`} 
      className="group flex flex-col h-full bg-brandWhite rounded-2xl overflow-hidden hover:-translate-y-1 hover:scale-[1.01] shadow-sm hover:shadow-lg transition-all duration-500 ease-out relative no-underline border border-brandBorder/40"
    >
      <div className="relative aspect-square w-full bg-[var(--background-secondary)] overflow-hidden">
        {displayImage && !imgError ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 768px) 50vw, 33vw"
            onError={() => setImgError(true)}
            className={`object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
              isSoldOut ? "opacity-50 grayscale-[30%]" : ""
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-widest font-light p-4 text-center">
            <span className="font-semibold text-sm">AL PARFUME</span>
            <span className="text-[10px] opacity-70 mt-1">Foto Tidak Tersedia</span>
          </div>
        )}

        {/* Sold Out or Low Stock Overlay Badge */}
        {isSoldOut ? (
          <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-10 bg-black text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2.5 sm:px-3.5 py-1.5 sm:py-2 font-sans select-none">
            Stok Habis
          </div>
        ) : isLowStock ? (
          <div className="absolute top-2.5 left-2.5 sm:top-4 sm:left-4 z-10 bg-red-600 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2.5 sm:px-3.5 py-1.5 sm:py-2 font-sans select-none">
            Stok Menipis
          </div>
        ) : null}
      </div>
      
      <div className="p-3.5 sm:p-5 pt-3 sm:pt-4 flex-grow flex flex-col justify-between gap-2.5 sm:gap-3">
        <h3 className="text-sm sm:text-base font-semibold text-brandBlack tracking-tight">
          {toTitleCase(product.name)}
        </h3>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0">
          <span className="text-xs sm:text-sm font-semibold text-[var(--foreground)]">
            {minPrice !== null ? formatRupiah(minPrice) : "Hubungi Kami"}
          </span>
          {!isSoldOut && product.stock !== undefined && product.stock !== null && product.stock > 0 && (
            <span className="self-start sm:self-auto text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium bg-[var(--background-secondary)] px-2 sm:px-2.5 py-0.5 rounded-full">
              Stok: {product.stock}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
