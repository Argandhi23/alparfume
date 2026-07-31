import { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutClient } from "@/components/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout & Pembayaran",
  description: "Lengkapi data pengiriman dan pilih metode pembayaran untuk memesan koleksi parfum AL PARFUME.",
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] font-sans">
          <div className="text-xs font-semibold animate-pulse">Memuat Checkout...</div>
        </div>
      }
    >
      <CheckoutClient />
    </Suspense>
  );
}
