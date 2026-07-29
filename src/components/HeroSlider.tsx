"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Banner } from "@/lib/supabase";

interface HeroSliderProps {
  banners?: Banner[];
}

const defaultSlides = [
  {
    id: "default-1",
    title: "Banner Slide 1",
    bgColor: "bg-neutral-300",
    image_url: null,
  },
  {
    id: "default-2",
    title: "Banner Slide 2",
    bgColor: "bg-stone-300",
    image_url: null,
  },
  {
    id: "default-3",
    title: "Banner Slide 3",
    bgColor: "bg-slate-300",
    image_url: null,
  },
];

export default function HeroSlider({ banners = [] }: HeroSliderProps) {
  const activeBanners = banners.filter((b) => b.is_active);
  const slides = activeBanners.length > 0 ? activeBanners : defaultSlides;

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 pt-4 pb-2">
      {/* Standard 16:9 aspect ratio banner */}
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl shadow-sm bg-neutral-200">
        {/* Slides Container */}
        <div
          className="flex w-full h-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide) => {
            const hasImage = "image_url" in slide && slide.image_url;

            return (
              <div
                key={slide.id}
                className={`w-full h-full flex-shrink-0 ${
                  "bgColor" in slide ? slide.bgColor : "bg-neutral-300"
                } flex items-center justify-center relative select-none overflow-hidden`}
              >
                {hasImage ? (
                  <Image
                    src={slide.image_url as string}
                    alt={("title" in slide && slide.title) || "Banner"}
                    fill
                    priority
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-black/5" />
                    <div className="relative z-10 text-center px-4">
                      <span className="text-sm sm:text-base md:text-xl tracking-[0.25em] uppercase font-bold text-neutral-700/80 font-sans">
                        {"title" in slide ? slide.title : "Banner"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              aria-label="Previous Slide"
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/70 hover:bg-white/95 text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 opacity-80 hover:opacity-100"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next Slide"
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/70 hover:bg-white/95 text-neutral-800 flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 opacity-80 hover:opacity-100"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === index
                    ? "w-6 h-2 bg-black"
                    : "w-2 h-2 bg-black/40 hover:bg-black/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
