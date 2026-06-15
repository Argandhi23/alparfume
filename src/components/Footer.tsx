import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-brandWhite border-t border-brandBorder text-neutral-500 py-16 px-6 font-sans text-sm transition-colors duration-300">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Column 1: Brand Block */}
        <div className="space-y-4">
          <h3 className="font-plus-jakarta text-lg font-semibold text-brandBlack">
            Al Parfume
          </h3>
          <p className="text-xs leading-relaxed max-w-xs font-light text-neutral-400 font-sans">
            Sentuhan kemewahan aromatik terbaik. Dirancang dengan presisi untuk mendampingi setiap langkah Anda.
          </p>
        </div>

        {/* Column 2: Quick Links */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-widest text-brandBlack font-semibold">
            Tautan Cepat
          </h4>
          <ul className="space-y-2 text-xs font-light font-sans">
            <li>
              <Link href="/#koleksi" className="hover:text-brandBlack transition-colors">
                Katalog Produk
              </Link>
            </li>
            <li>
              <Link href="/#tentang" className="hover:text-brandBlack transition-colors">
                Tentang Kami (About)
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Contact & Socials */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-widest text-brandBlack font-semibold font-sans">
            Hubungi Kami & Layanan
          </h4>
          <ul className="space-y-2.5 text-xs font-light font-sans">
            <li>
              <span className="text-xs text-neutral-400">Melayani COD area Madiun</span>
            </li>
            <li>
              WhatsApp: <span className="font-medium text-brandBlack">6281915931190</span>
            </li>
            <li className="flex flex-col gap-2 pt-1">
              <Link 
                href="https://www.instagram.com/al.parfumeco" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 hover:text-brandBlack transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 fill-none stroke-current"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span>Instagram: @al.parfumeco</span>
              </Link>
              
              <Link 
                href="https://shopee.co.id/al.parfumeco" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 hover:text-brandBlack transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Shopee: al.parfumeco</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-6xl mx-auto border-t border-brandBorder/40 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 font-light">
        <p>© {new Date().getFullYear()} AL PARFUME. All rights reserved.</p>
        <p className="mt-2 sm:mt-0 font-sans tracking-wide">Madiun, Indonesia</p>
      </div>
    </footer>
  );
}
