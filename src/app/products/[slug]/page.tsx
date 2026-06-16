import { supabase } from "@/lib/supabase";
import ProductDetailsClient from "@/components/ProductDetailsClient";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 0;

interface ProductPageProps {
  params: {
    slug: string;
  };
}

async function getProductDetails(slug: string) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*)")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error retrieving product details:", err);
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps) {
  const product = await getProductDetails(params.slug);
  
  if (!product) {
    return {
      title: "Produk Tidak Ditemukan",
      description: "Halaman produk AL PARFUME tidak ditemukan.",
    };
  }

  // Parse images JSON array to get the first image for OG if it exists
  let firstImageUrl = "/logo.png";
  if (product.image_url) {
    if (product.image_url.startsWith("[")) {
      try {
        const imageList = JSON.parse(product.image_url);
        if (imageList && imageList.length > 0) {
          firstImageUrl = imageList[0];
        }
      } catch {
        firstImageUrl = product.image_url;
      }
    } else {
      firstImageUrl = product.image_url;
    }
  }

  const title = product.name;
  const description = product.description || `Beli ${product.name} dari AL PARFUME. Parfum mewah, minimalis, dan tahan lama dengan notes terbaik.`;

  return {
    title: title,
    description: description,
    alternates: {
      canonical: `https://alparfume.store/products/${product.slug}`,
    },
    openGraph: {
      title: `${title} | AL PARFUME`,
      description: description,
      url: `https://alparfume.store/products/${product.slug}`,
      type: "website",
      images: [
        {
          url: firstImageUrl,
          alt: `${title} - AL PARFUME`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | AL PARFUME`,
      description: description,
      images: [firstImageUrl],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductDetails(params.slug);

  if (!product) {
    notFound();
  }

  // Parse images JSON array
  let imageList: string[] = [];
  if (product.image_url) {
    if (product.image_url.startsWith("[")) {
      try {
        imageList = JSON.parse(product.image_url);
      } catch {
        imageList = [product.image_url];
      }
    } else {
      imageList = [product.image_url];
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack">
      <Navbar />
      <main className="flex-grow py-16 px-6 md:py-24">
        <div className="max-w-6xl mx-auto">
          {/* Back Link */}
          <Link 
            href="/#koleksi" 
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-400 hover:text-brandBlack transition-colors duration-200 mb-12 font-sans font-light"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Koleksi
          </Link>

          {/* Product Details Split Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left Column: Image Carousel (Sticky on desktop) */}
            <div>
              <ProductImageCarousel images={imageList} productName={product.name} />
            </div>

            {/* Right Column: Details Pane */}
            <div className="bg-brandWhite p-2 md:p-0">
              <ProductDetailsClient product={product} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
