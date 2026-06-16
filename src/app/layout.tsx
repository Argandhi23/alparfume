import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { CartProvider } from "@/context/CartContext";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://alparfume.store"),
  title: {
    default: "AL PARFUME | Koleksi Parfum Mewah Minimalis",
    template: "%s | AL PARFUME",
  },
  description: "Temukan aroma yang mencerminkan siapa dirimu. Koleksi parfum mewah minimalis, elegan, dan tahan lama dari AL PARFUME. Beli sekarang via WhatsApp atau Shopee.",
  keywords: [
    "Al Parfume",
    "parfum madiun",
    "parfum mewah",
    "parfum minimalis",
    "parfum lokal terbaik",
    "beli parfum",
    "parfum elegan",
    "parfum wangi tahan lama",
    "toko parfum madiun",
  ],
  authors: [{ name: "AL PARFUME" }],
  openGraph: {
    title: "AL PARFUME | Koleksi Parfum Mewah Minimalis",
    description: "Koleksi parfum mewah minimalis, elegan, dan tahan lama. Hubungi kami melalui WhatsApp atau Shopee untuk pemesanan langsung.",
    url: "https://alparfume.store",
    siteName: "AL PARFUME",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/logo.png",
        alt: "AL PARFUME - Koleksi Parfum Mewah Minimalis",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "AL PARFUME | Koleksi Parfum Mewah Minimalis",
    description: "Koleksi parfum mewah minimalis, elegan, dan tahan lama. Hubungi kami melalui WhatsApp atau Shopee untuk pemesanan langsung.",
    images: ["/logo.png"],
  },
  alternates: {
    canonical: "https://alparfume.store",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "emKwpEDZnbo9tkJKYUh4kWyzWBac6JJGMbzc--EUQlk",
  },
};

export const viewport: Viewport = {
  themeColor: "#ed1140",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body className="font-sans bg-brandWhite text-brandBlack min-h-screen selection:bg-brandBlack selection:text-brandWhite">
        <ThemeProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
