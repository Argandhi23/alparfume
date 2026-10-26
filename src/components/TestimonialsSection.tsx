"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, CheckCircle2, ChevronLeft, ChevronRight, X, ZoomIn, ArrowUpRight } from "lucide-react";
import { Testimonial } from "@/lib/supabase";
import { sanitizeImageUrl } from "@/lib/imageHelper";

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
}

export default function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<{
    imageUrl: string;
    customerName: string;
    productName: string;
    productSlug?: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Filter only active testimonials or use all provided
  const activeList = testimonials.filter((t) => t.is_active !== false);

  // Update scroll button availability
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [activeList]);

  // Smooth auto-scroll interval (pauses on hover or touch)
  useEffect(() => {
    if (isPaused || activeList.length <= 1) return;

    const interval = setInterval(() => {
      if (!scrollContainerRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      const cardWidth = 320; // approximate scroll step

      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        // loop back to start
        scrollContainerRef.current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, activeList.length]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const step = 340;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  // Helper for initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (!activeList || activeList.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-16 bg-brandWhite font-sans">
      {/* Header Minimalis & Bersih */}
      <div className="flex flex-col items-center justify-center text-center space-y-2 mb-8 md:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-brandBlack tracking-tight font-sans">
          Ulasan Pelanggan
        </h2>
        {/* Rating Bintang Ringkas */}
        <div className="flex items-center gap-1 text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
          ))}
        </div>
      </div>

      {/* Carousel Container */}
      <div
        className="relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Left Arrow (Desktop) */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll("left")}
            aria-label="Geser ke kiri"
            className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 border border-neutral-200/90 shadow-md hover:bg-neutral-100 hover:scale-105 active:scale-95 items-center justify-center text-neutral-800 transition-all cursor-pointer backdrop-blur-xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Arrow (Desktop) */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll("right")}
            aria-label="Geser ke kanan"
            className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/95 border border-neutral-200/90 shadow-md hover:bg-neutral-100 hover:scale-105 active:scale-95 items-center justify-center text-neutral-800 transition-all cursor-pointer backdrop-blur-xs"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Horizontal Scrollable Track */}
        <div
          ref={scrollContainerRef}
          className="flex items-start gap-4 sm:gap-6 overflow-x-auto pb-6 pt-2 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {activeList.map((item) => {
            const displayPhoto = sanitizeImageUrl(item.image_url);
            const displayAvatar = sanitizeImageUrl(item.customer_avatar_url);
            const productName = item.product_name_override || item.products?.name || "Parfum Al Parfume";
            const productSlug = item.products?.slug;
            const productLink = productSlug ? `/products/${productSlug}` : "/#koleksi";

            return (
              <div
                key={item.id}
                className="w-[285px] sm:w-[320px] md:w-[340px] shrink-0 snap-start bg-brandWhite rounded-2xl p-5 border border-brandBorder/60 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col"
              >
                {/* Bagian Atas: Avatar, Nama, Verified Buyer, Bintang */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar Profile Picture / Monogram Fallback */}
                      {displayAvatar ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-neutral-200/80 shrink-0 shadow-xs">
                          <Image
                            src={displayAvatar}
                            alt={`Foto profil ${item.customer_name}`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 font-bold text-xs tracking-wider select-none shrink-0 shadow-xs">
                          {getInitials(item.customer_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-brandBlack tracking-tight truncate">
                          {item.customer_name}
                        </p>
                        {item.is_verified_buyer !== false && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200/70 select-none mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Verified Buyer
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bintang Rating */}
                    <div className="flex items-center gap-0.5 shrink-0 pt-0.5 text-amber-400">
                      {[...Array(item.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Isi Ulasan */}
                  <p className="text-xs sm:text-sm text-neutral-600 font-normal leading-relaxed line-clamp-4 italic mb-2">
                    &ldquo;{item.review_text}&rdquo;
                  </p>

                  {/* Thumbnail Foto Pelanggan (Hanya muncul jika ada foto) */}
                  {displayPhoto && (
                    <div
                      onClick={() =>
                        setSelectedPhoto({
                          imageUrl: displayPhoto,
                          customerName: item.customer_name,
                          productName,
                          productSlug,
                        })
                      }
                      className="relative w-full h-36 rounded-xl overflow-hidden cursor-pointer group/photo border border-neutral-200/80 mt-2 mb-2 bg-neutral-100"
                    >
                      <Image
                        src={displayPhoto}
                        alt={`Foto ulasan oleh ${item.customer_name}`}
                        fill
                        unoptimized
                        className="object-cover group-hover/photo:scale-105 transition-transform duration-500 ease-out"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-xs">
                        <ZoomIn className="w-4 h-4" />
                        <span>Lihat Foto</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bagian Bawah: Link Varian Parfum (Menempel rapi ke teks bila tanpa foto) */}
                <div className="pt-3 border-t border-neutral-100 mt-2">
                  <Link
                    href={productLink}
                    className="group/link flex items-center justify-between text-xs text-neutral-600 hover:text-black transition-colors"
                  >
                    <span className="truncate">
                      Varian: <strong className="text-brandBlack font-semibold">{productName}</strong>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-neutral-400 group-hover/link:text-black group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-all" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Lightbox Foto Ulasan */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              aria-label="Tutup foto"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* High-res Image Preview */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 mb-4">
              <Image
                src={selectedPhoto.imageUrl}
                alt={`Foto unboxing oleh ${selectedPhoto.customerName}`}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            {/* Info Reviewer & Action */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-500 font-medium">Foto oleh</p>
                <p className="text-sm font-bold text-brandBlack">{selectedPhoto.customerName}</p>
                <p className="text-xs text-neutral-600 mt-0.5 font-medium">{selectedPhoto.productName}</p>
              </div>

              {selectedPhoto.productSlug && (
                <Link
                  href={`/products/${selectedPhoto.productSlug}`}
                  onClick={() => setSelectedPhoto(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors shadow-sm"
                >
                  <span>Lihat Parfum</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
