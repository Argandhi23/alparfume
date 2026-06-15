"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface ProductImageCarouselProps {
  images: string[];
  productName: string;
}

export default function ProductImageCarousel({ images, productName }: ProductImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setUserInteracted(false);
  }, [images, productName]);

  useEffect(() => {
    if (images.length <= 1) return;

    if (userInteracted) {
      // Pause autoplay for 5 seconds of inactivity
      const resumeTimeout = setTimeout(() => {
        setUserInteracted(false);
      }, 5000);
      return () => clearTimeout(resumeTimeout);
    }

    // Auto-rotate every 3 seconds
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [images.length, userInteracted]);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square w-full bg-[var(--background-secondary)] overflow-hidden border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--text-muted)] text-xs uppercase tracking-widest font-light">
        Belum ada foto
      </div>
    );
  }

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    setUserInteracted(true);
  };

  return (
    <div className="space-y-4 md:sticky md:top-24">
      {/* Slide Canvas */}
      <div className="relative aspect-square w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {images.map((url, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={`${url}-${index}`}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Image
                src={url}
                alt={`${productName} - Angle ${index + 1}`}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Slide Navigation Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-4 justify-start items-center">
          {images.map((url, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={`${url}-thumb-${index}`}
                onClick={() => handleThumbnailClick(index)}
                className={`relative w-20 h-20 bg-[var(--background-secondary)] rounded-lg overflow-hidden transition-all duration-200 ${
                  isActive
                    ? "border-2 border-[var(--foreground)] opacity-100"
                    : "border border-[var(--border)] opacity-60 hover:opacity-100 hover:border-[var(--foreground)]/40"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={`${productName} Thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
