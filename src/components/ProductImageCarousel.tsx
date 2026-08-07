"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { sanitizeImageUrl } from "@/lib/imageHelper";

interface ProductImageCarouselProps {
  images: string[];
  productName: string;
}

export default function ProductImageCarousel({ images, productName }: ProductImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [failedIndexes, setFailedIndexes] = useState<Record<number, boolean>>({});

  const validImages = images
    .map((url) => sanitizeImageUrl(url))
    .filter((url): url is string => Boolean(url));

  useEffect(() => {
    setCurrentIndex(0);
    setUserInteracted(false);
    setFailedIndexes({});
  }, [images, productName]);

  useEffect(() => {
    if (validImages.length <= 1) return;

    if (userInteracted) {
      const resumeTimeout = setTimeout(() => {
        setUserInteracted(false);
      }, 5000);
      return () => clearTimeout(resumeTimeout);
    }

    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % validImages.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [validImages.length, userInteracted]);

  if (validImages.length === 0) {
    return (
      <div className="relative aspect-square w-full bg-[var(--background-secondary)] overflow-hidden border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-muted)] text-xs uppercase tracking-widest font-light p-4 text-center">
        <span className="font-semibold text-sm">AL PARFUME</span>
        <span className="text-[10px] opacity-70 mt-1">Belum ada foto</span>
      </div>
    );
  }

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    setUserInteracted(true);
  };

  const handleImageError = (index: number) => {
    setFailedIndexes((prev) => ({ ...prev, [index]: true }));
  };

  return (
    <div className="space-y-4 md:sticky md:top-24">
      {/* Slide Canvas */}
      <div className="relative aspect-square w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {validImages.map((url, index) => {
          const isActive = index === currentIndex;
          const isFailed = failedIndexes[index];

          return (
            <div
              key={`${url}-${index}`}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {!isFailed ? (
                <Image
                  src={url}
                  alt={`${productName} - Angle ${index + 1}`}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  onError={() => handleImageError(index)}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-widest font-light p-4 text-center">
                  <span className="font-semibold text-sm">AL PARFUME</span>
                  <span className="text-[10px] opacity-70 mt-1">Foto Tidak Tersedia</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slide Navigation Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex gap-4 justify-start items-center overflow-x-auto pb-1">
          {validImages.map((url, index) => {
            const isActive = index === currentIndex;
            const isFailed = failedIndexes[index];

            return (
              <button
                key={`${url}-thumb-${index}`}
                onClick={() => handleThumbnailClick(index)}
                className={`relative w-20 h-20 bg-[var(--background-secondary)] rounded-lg overflow-hidden transition-all duration-200 shrink-0 ${
                  isActive
                    ? "border-2 border-[var(--foreground)] opacity-100"
                    : "border border-[var(--border)] opacity-60 hover:opacity-100 hover:border-[var(--foreground)]/40"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              >
                {!isFailed ? (
                  <Image
                    src={url}
                    alt={`${productName} Thumbnail ${index + 1}`}
                    fill
                    sizes="80px"
                    onError={() => handleImageError(index)}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400 font-bold">
                    AL
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
