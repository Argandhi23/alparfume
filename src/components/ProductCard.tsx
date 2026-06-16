import Link from "next/link";
import Image from "next/image";
import { formatRupiah } from "@/lib/whatsapp";
import { ProductWithVariants } from "@/lib/supabase";

interface ProductCardProps {
  product: ProductWithVariants;
}

export default function ProductCard({ product }: ProductCardProps) {
  const prices = product.product_variants?.map((v) => v.price) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  let displayImage = "";
  if (product.image_url) {
    if (product.image_url.startsWith("[")) {
      try {
        const parsed = JSON.parse(product.image_url);
        if (Array.isArray(parsed) && parsed.length > 0) {
          displayImage = parsed[0];
        }
      } catch {
        displayImage = product.image_url;
      }
    } else {
      displayImage = product.image_url;
    }
  }

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
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className={`object-cover group-hover:scale-105 transition-transform duration-700 ease-out ${
              product.is_sold_out ? "blur-[2px] opacity-75" : ""
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-widest font-light">
            Belum ada foto
          </div>
        )}

        {/* Sold Out Overlay Badge */}
        {product.is_sold_out && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[0.5px]">
            <span className="bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-lg border border-red-500/30">
              Stok Habis
            </span>
          </div>
        )}
      </div>
      
      <div className="p-5 pt-4 flex-grow flex flex-col justify-between gap-3">
        <h3 className="text-base font-semibold text-brandBlack tracking-tight">
          {toTitleCase(product.name)}
        </h3>
        
        <div>
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {minPrice !== null ? formatRupiah(minPrice) : "Hubungi Kami"}
          </span>
        </div>
      </div>
    </Link>
  );
}
