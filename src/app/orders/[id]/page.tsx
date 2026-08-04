import { createClient } from "@supabase/supabase-js";
import { OrderIntent } from "@/lib/supabase";
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

async function getOrderDetails(id: string): Promise<OrderIntent | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const queryCode = id.trim();

    // 1. Check new 'orders' table first
    let orderQuery = serviceClient
      .from("orders")
      .select(`
        *,
        customer:customers(*),
        order_items(*),
        payment_proofs(*)
      `);

    const numericId = parseInt(queryCode, 10);
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      orderQuery = orderQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      orderQuery = orderQuery.or(`order_code.eq.${queryCode},order_code.ilike.%${queryCode}%`);
    }

    const { data: orders } = await orderQuery.limit(1);

    if (orders && orders.length > 0) {
      const order = orders[0];
      const proofs = Array.isArray(order.payment_proofs)
        ? order.payment_proofs.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];
      const latestProofUrl = proofs.length > 0 ? proofs[0].image_url : null;

      const itemsList = (order.order_items || []).map((item: { product_name_snapshot: string; size_ml_snapshot: number; qty: number; price_snapshot: number; total_price: number }) => ({
        productName: item.product_name_snapshot,
        sizeMl: item.size_ml_snapshot,
        quantity: item.qty,
        price: item.price_snapshot,
        totalItemPrice: item.total_price
      }));

      return {
        id: order.id,
        order_code: order.order_code,
        customer_name: order.customer?.name || null,
        customer_wa: order.customer?.wa_number || null,
        customer_address: order.customer?.address || null,
        order_notes: order.order_notes,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        tracking_number: order.tracking_number,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        delivery_method: order.delivery_method,
        grand_total: order.grand_total,
        total_price: order.grand_total,
        price: order.grand_total,
        payment_proof_url: latestProofUrl,
        items_json: JSON.stringify({ items: itemsList }),
        created_at: order.created_at,
        product_name: itemsList.length > 0 ? itemsList[0].productName : "Pesanan Parfum",
        size_ml: itemsList.length > 0 ? itemsList[0].sizeMl : 35,
      } as unknown as OrderIntent;
    }

    // 2. Fallback Hibrid: Check historical 'order_intents' table
    let fallbackQuery = serviceClient.from("order_intents").select("*");
    if (!isNaN(numericId) && numericId > 0 && String(numericId) === queryCode) {
      fallbackQuery = fallbackQuery.or(`id.eq.${numericId},order_code.eq.${queryCode}`);
    } else {
      fallbackQuery = fallbackQuery.or(`order_code.eq.${queryCode},id.eq.${queryCode},items_json.ilike.%${queryCode}%`);
    }

    const { data: intents } = await fallbackQuery.limit(1);

    if (intents && intents.length > 0) {
      return intents[0] as OrderIntent;
    }

    return null;
  } catch (err) {
    console.error("Error fetching order details in SSR:", err);
    return null;
  }
}

function maskWaNumber(wa: string | null | undefined): string | null {
  if (!wa) return null;
  const clean = wa.replace(/[^\d]/g, "");
  if (clean.length < 8) return "0819****1190";
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

function maskAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }
  return address;
}

export async function generateMetadata({ params }: OrderPageProps) {
  return {
    title: `Pesanan #${params.id} | Al Parfume`,
    description: `Cek status pembayaran QRIS dan Nomor Resi pengiriman pesanan #${params.id}.`,
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const initialOrder = await getOrderDetails(params.id);
  const canonicalOrderCode = initialOrder?.order_code || params.id;

  if (initialOrder) {
    initialOrder.customer_wa = maskWaNumber(initialOrder.customer_wa);
    initialOrder.customer_address = maskAddress(initialOrder.customer_address);
  }

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

        <OrderStatusClient orderId={canonicalOrderCode} initialOrder={initialOrder} />
      </main>
      <Footer />
    </div>
  );
}
