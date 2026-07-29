"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Banner } from "@/lib/supabase";

interface HeroSliderProps {
  banners?: Banner[];
}

const defaultSlides = [
  {
    id: "default-1",
    title: "AL PARFUME EXCLUSIVE COLLECTION",
    subtitle: "Koleksi Aromatik Premium 2026",
    bgColor: "bg-neutral-900 text-white",
    image_url: null,
  },
  {
    id: "default-2",
    title: "SERENITY & PINK ROMANCE",
    subtitle: "Aroma Bunga & Musk Penuh Pesona",
    bgColor: "bg-stone-900 text-white",
    image_url: null,
  },
  {
    id: "default-3",
    title: "ELYSIAN VANILLA EDP",
    subtitle: "Sensasi Manis Vanilla Orchid & Amber",
    bgColor: "bg-zinc-900 text-white",
    image_url: null,
  },
  {
    id: "default-4",
    title: "MERRY KISS & GUAVIN",
    subtitle: "Kesegaran Buah Tropis Yang Ceria",
    bgColor: "bg-neutral-900 text-white",
    image_url: null,
  },
  {
    id: "default-5",
    title: "POCKET EDITION 20ML",
    subtitle: "Parfum Kompak Praktis Untuk Aktivitas Seharian",
    bgColor: "bg-stone-950 text-white",
    image_url: null,
  },
  {
    id: "default-6",
    title: "BEBAS ONGKIR & BISA COD",
    subtitle: "Pengiriman Ke Seluruh Indonesia & Ambil Di Toko",
    bgColor: "bg-neutral-950 text-white",
    image_url: null,
  },
];

export default function HeroSlider({ banners = [] }: HeroSliderProps) {
  const activeBanners = banners.filter((b) => b.is_active);
  const slides = activeBanners.length > 0 ? activeBanners : defaultSlides;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-slide effect
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 40;

    if (distance > minSwipeDistance) {
      // Swiped Left -> Next Slide
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (distance < -minSwipeDistance) {
      // Swiped Right -> Previous Slide
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const offset = e.clientX - dragStartX;
    setDragOffset(offset);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset < -50) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (dragOffset > 50) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
    setDragOffset(0);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 pt-4 pb-2">
      {/* Standard 16:9 aspect ratio banner */}
      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl shadow-md bg-neutral-900 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Slides Container */}
        <div
          className={`flex w-full h-full ${isDragging ? "transition-none" : "transition-transform duration-700 ease-out"}`}
          style={{ 
            transform: `translateX(calc(-${currentSlide * 100}% + ${dragOffset}px))` 
          }}
        >
          {slides.map((slide) => {
            const hasImage = "image_url" in slide && slide.image_url;

            return (
              <div
                key={slide.id}
                className={`w-full h-full flex-shrink-0 ${
                  "bgColor" in slide ? slide.bgColor : "bg-neutral-900 text-white"
                } flex items-center justify-center relative select-none overflow-hidden`}
              >
                {hasImage ? (
                  <Image
                    src={slide.image_url as string}
                    alt={("title" in slide && slide.title) || "Banner Promo"}
                    fill
                    priority
                    className="object-cover w-full h-full pointer-events-none"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                    <div className="relative z-10 text-center px-6 max-w-xl space-y-2 pointer-events-none font-sans">
                      <span className="text-xs sm:text-sm md:text-base tracking-[0.3em] uppercase font-semibold text-neutral-400 block">
                        Al Parfume Official
                      </span>
                      <h2 className="text-lg sm:text-2xl md:text-4xl font-extrabold text-white font-sans tracking-tight">
                        {"title" in slide ? slide.title : "Banner Promo"}
                      </h2>
                      {"subtitle" in slide && slide.subtitle && (
                        <p className="text-xs sm:text-sm text-neutral-300 font-sans opacity-90 hidden sm:block">
                          {slide.subtitle}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Ke slide ${index + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === index
                    ? "w-6 h-2 bg-white shadow"
                    : "w-2 h-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
