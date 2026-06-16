import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-brandWhite border-t border-brandBorder text-neutral-500 py-16 px-6 font-sans text-sm transition-colors duration-300">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Column 1: Brand Block */}
        <div className="space-y-4">
          <Image
            src="/logo.png"
            alt="Al Parfume"
            width={100}
            height={34}
            className="h-8 w-auto object-contain mb-3 logo-img"
          />
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
            <li className="flex flex-col gap-2 pt-1">
              <Link 
                href="https://wa.me/6281915931190" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 hover:text-brandBlack transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.498 1.45 5.441 1.451 5.58 0 10.121-4.54 10.124-10.122.002-2.705-1.05-5.247-2.96-7.16C17.34 1.41 14.8 0.355 12.01 0.355c-5.583 0-10.124 4.54-10.128 10.124-.001 1.94.504 3.836 1.465 5.432l-1.012 3.7 3.791-.994zm13.067-6.308c-.287-.143-1.695-.837-1.957-.932-.262-.095-.453-.143-.644.143-.191.286-.74.932-.907 1.123-.167.19-.334.214-.62.071-1.285-.642-2.13-1.164-2.986-2.628-.227-.389.227-.361.649-1.205.07-.143.035-.268-.018-.375-.053-.107-.453-1.09-.62-1.498-.162-.39-.328-.337-.452-.343-.117-.005-.25-.006-.382-.006-.133 0-.35.05-.533.25-.183.2-.7.683-.7 1.666 0 .983.715 1.932.815 2.067.1.135 1.407 2.149 3.409 3.012 1.133.489 1.694.593 2.296.503.626-.094 1.695-.692 1.933-1.362.238-.67.238-1.243.167-1.362-.07-.12-.262-.215-.549-.357z"/>
                </svg>
                <span>WhatsApp: +62 819-1593-1190</span>
              </Link>

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
                  <line x1="17.5" y1="6.5" />
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
