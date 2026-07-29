import { supabase, OrderIntent } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OrderStatusClient from "@/components/OrderStatusClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface OrderPageProps {
  params: {
    id: string;
  };
}

async function getOrderDetails(id: string) {
  try {
    const numericId = parseInt(id);

    if (!isNaN(numericId)) {
      const { data, error } = await supabase
        .from("order_intents")
        .select("*")
        .eq("id", numericId)
        .single();

      if (!error && data) {
        return data as OrderIntent;
      }
    }

    return null;
  } catch (err) {
    console.error("Error fetching order details:", err);
    return null;
  }
}

export async function generateMetadata({ params }: OrderPageProps) {
  return {
    title: `Pesanan #${params.id} | Al Parfume`,
    description: `Cek status pembayaran QRIS dan Nomor Resi pengiriman pesanan #${params.id}.`,
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const initialOrder = await getOrderDetails(params.id);

  return (
    <div className="flex flex-col min-h-screen bg-brandWhite text-brandBlack font-sans">
      <Navbar />
      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-16 w-full">
        {/* Navigation Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        <OrderStatusClient orderId={params.id} initialOrder={initialOrder} />
      </main>
      <Footer />
    </div>
  );
}
