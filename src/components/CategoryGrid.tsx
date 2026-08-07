"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Category } from "@/lib/supabase";
import { sanitizeImageUrl } from "@/lib/imageHelper";

interface CategoryGridProps {
  categories?: Category[];
}

const DEFAULT_SAMPLE_CATEGORY: Category = {
  id: "4ed0369c-e713-47d0-9e20-c267c05833c7",
  name: "Sample",
  slug: "sample",
  image_url: null,
  bg_color: "bg-neutral-300",
  sort_order: 1,
};

const DEFAULT_CATEGORIES: Category[] = [
  DEFAULT_SAMPLE_CATEGORY,
  {
    id: "82108b95-6071-499c-8741-e1852ac24163",
    name: "Eau de Toilette",
    slug: "eau-de-toilette",
    image_url: null,
    bg_color: "bg-stone-300",
    sort_order: 2,
  },
  {
    id: "e2e2e2e2-e2e2-11ee-8656-0242ac130002",
    name: "Eau de Parfum",
    slug: "eau-de-parfum",
    image_url: null,
    bg_color: "bg-zinc-300",
    sort_order: 3,
  },
  {
    id: "e3e3e3e3-e3e3-11ee-8656-0242ac130002",
    name: "Extrait de Parfum",
    slug: "extrait-de-parfum",
    image_url: null,
    bg_color: "bg-slate-300",
    sort_order: 4,
  },
];

function CategoryItem({ cat }: { cat: Category }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = sanitizeImageUrl(cat.image_url);

  return (
    <Link
      href={`/categories/${cat.slug}`}
      className="group relative aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] w-full overflow-hidden rounded-lg sm:rounded-xl shadow-sm hover:shadow-xl transition-all duration-500 block cursor-pointer select-none"
    >
      {/* Background Image or Solid Color */}
      {imageUrl && !imgError ? (
        <Image
          src={imageUrl}
          alt={cat.name}
          fill
          onError={() => setImgError(true)}
          className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105"
        />
      ) : (
        <div
          className={`absolute inset-0 w-full h-full ${
            cat.bg_color || "bg-neutral-300"
          } transition-transform duration-700 ease-out group-hover:scale-105`}
        />
      )}

      {/* Subtle Overlay for Readability */}
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors duration-300" />

      {/* Centered Category Title */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <h2 className="text-white text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight drop-shadow-md group-hover:scale-105 transition-transform duration-300 text-center font-sans leading-tight">
          {cat.name}
        </h2>
      </div>
    </Link>
  );
}

export default function CategoryGrid({ categories = [] }: CategoryGridProps) {
  const items = categories.length > 0 ? [...categories] : [...DEFAULT_CATEGORIES];

  // Guarantee "Sample" category is ALWAYS present
  const hasSample = items.some(
    (c) => c.slug.toLowerCase() === "sample" || c.name.toLowerCase() === "sample"
  );

  if (!hasSample) {
    items.unshift(DEFAULT_SAMPLE_CATEGORY);
  }

  // Sort by sort_order
  items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <section className="w-full px-4 sm:px-6 md:px-8 py-6 md:py-10 max-w-[1400px] mx-auto font-sans">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {items.map((cat) => (
          <CategoryItem key={cat.id} cat={cat} />
        ))}
      </div>
    </section>
  );
}
