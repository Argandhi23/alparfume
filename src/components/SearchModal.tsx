"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { supabase, ProductWithVariants, ProductVariant } from "@/lib/supabase";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all active products (including sold-out items) on modal open
  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus input field
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data: prodData } = await supabase
          .from("products")
          .select("*, product_variants(*)")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (prodData) {
          setProducts(prodData as ProductWithVariants[]);
        }
      } catch (err) {
        console.error("Search fetch products error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Case-insensitive & space-normalized matching
  const normalizedQuery = query.toLowerCase().trim();

  // Includes sold-out products in search matching!
  const filteredProducts = normalizedQuery
    ? products.filter((product) => {
        const variantsList: ProductVariant[] =
          product.product_variants ||
          (product as unknown as { variants?: ProductVariant[] }).variants ||
          [];

        const nameLower = (product.name || "").toLowerCase();
        const descLower = (product.description || "").toLowerCase();
        const notesLower = (product.notes || "").toLowerCase();
        const topNotesLower = (product.top_notes || "").toLowerCase();
        const middleNotesLower = (product.middle_notes || "").toLowerCase();
        const bottomNotesLower = (product.bottom_notes || "").toLowerCase();

        const nameMatch = nameLower.includes(normalizedQuery);
        const descMatch = descLower.includes(normalizedQuery);
        const notesMatch =
          notesLower.includes(normalizedQuery) ||
          topNotesLower.includes(normalizedQuery) ||
          middleNotesLower.includes(normalizedQuery) ||
          bottomNotesLower.includes(normalizedQuery);

        const variantMatch = variantsList.some(
          (v) =>
            `${v.size_ml}ml`.toLowerCase().includes(normalizedQuery) ||
            `${v.price}`.includes(normalizedQuery)
        );

        return nameMatch || descMatch || notesMatch || variantMatch;
      })
    : [];

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getLowestPrice = (product: ProductWithVariants) => {
    const variantsList: ProductVariant[] =
      product.product_variants ||
      (product as unknown as { variants?: ProductVariant[] }).variants ||
      [];
    if (variantsList.length > 0) {
      const prices = variantsList.map((v) => v.price);
      return Math.min(...prices);
    }
    return 0;
  };

  const getProductImage = (imageUrl: string | null) => {
    if (!imageUrl) return "/placeholder.jpg";
    if (imageUrl.startsWith("[")) {
      try {
        const parsed = JSON.parse(imageUrl);
        return parsed[0] || "/placeholder.jpg";
      } catch {
        return "/placeholder.jpg";
      }
    }
    return imageUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-16 px-3 sm:px-4 bg-black/50 backdrop-blur-sm transition-all duration-200 font-sans">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Search Modal Window */}
      <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] my-auto sm:my-0">
        
        {/* Search Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-neutral-100 flex items-center gap-3 bg-white">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari parfum, varian 50ml, aroma..."
            className="w-full bg-transparent border-none text-sm font-medium text-neutral-900 focus:outline-none placeholder:text-neutral-400 font-sans"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-neutral-400 hover:text-black rounded-full transition-colors"
              aria-label="Hapus kata kunci"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-black rounded-full hover:bg-neutral-100 transition-colors ml-1 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
          {!query ? (
            <div className="py-8 sm:py-10 text-center space-y-3">
              <p className="text-xs sm:text-sm font-semibold text-neutral-600">
                Ketik nama parfum atau wangi yang Anda cari
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {["Vanilla", "Sweet", "Fresh", "30ml", "50ml"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Memuat produk...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-10 text-center space-y-1 font-sans">
              <p className="text-sm font-bold text-neutral-800">Tidak ada produk yang cocok</p>
              <p className="text-xs text-neutral-500">
                Kata kunci &quot;{query}&quot; tidak ditemukan. Coba ketik wangi lain.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-1">
                {filteredProducts.length} Produk Ditemukan
              </div>

              <div className="divide-y divide-neutral-100">
                {filteredProducts.map((product) => {
                  const lowestPrice = getLowestPrice(product);
                  const img = getProductImage(product.image_url);
                  const isSoldOut =
                    product.is_sold_out ||
                    (product.stock !== null && product.stock !== undefined && product.stock <= 0);

                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 py-3 px-2 hover:bg-neutral-50 rounded-xl transition-colors group cursor-pointer"
                    >
                      <div className="relative w-14 h-14 bg-neutral-100 rounded-lg overflow-hidden shrink-0 border border-neutral-200">
                        <Image
                          src={img}
                          alt={product.name}
                          fill
                          className={`object-cover ${isSoldOut ? "grayscale opacity-70" : ""}`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs sm:text-sm text-neutral-900 uppercase truncate">
                            {product.name}
                          </h5>
                          {isSoldOut && (
                            <span className="text-[9px] font-extrabold bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded uppercase shrink-0">
                              Stok Habis
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {product.notes || product.description || "Al Parfume"}
                        </p>

                        <div className="text-xs font-bold text-neutral-900 mt-1">
                          {formatRupiah(lowestPrice)}
                        </div>
                      </div>

                      <div className="text-neutral-400 group-hover:text-black transition-colors pl-2">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
