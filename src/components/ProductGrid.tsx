import ProductCard from "./ProductCard";
import { ProductWithVariants } from "@/lib/supabase";

interface ProductGridProps {
  products: ProductWithVariants[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-brandBorder/80 bg-[var(--background-secondary)]/50 rounded-2xl">
        <p className="text-sm tracking-widest text-[var(--text-muted)] uppercase font-sans">
          Belum ada koleksi produk tersedia
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-10">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-10">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-[var(--background)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm animate-pulse">
          <div className="aspect-square bg-[var(--background-secondary)] w-full" />
          <div className="p-6 space-y-4">
            <div className="h-5 bg-[var(--border)] w-2/3 rounded" />
            <div className="h-3 bg-[var(--border)] w-full rounded" />
            <div className="pt-2 flex justify-between">
              <div className="h-3 bg-[var(--border)] w-1/4 rounded" />
              <div className="h-4 bg-[var(--border)] w-1/3 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
