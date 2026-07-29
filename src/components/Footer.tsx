"use client";

import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200/80 text-neutral-600 py-12 px-6 font-sans text-xs transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-10 md:gap-16">
        
        {/* Left Column: Brand Logo & Social Icons */}
        <div className="space-y-5">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.png"
              alt="Al Parfume"
              width={140}
              height={45}
              className="h-10 w-auto object-contain logo-img"
            />
          </Link>

          {/* Social Media Links (Strictly Black & White) */}
          <div className="flex items-center space-x-5 text-neutral-800 pt-1">
            {/* WhatsApp */}
            <Link 
              href="https://wa.me/6281915931190" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-800 hover:text-black hover:scale-110 transition-all duration-300"
              title="WhatsApp"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.458L0 24zm6.59-4.846c1.6.95 3.498 1.45 5.441 1.451 5.58 0 10.121-4.54 10.124-10.122.002-2.705-1.05-5.247-2.96-7.16C17.34 1.41 14.8 0.355 12.01 0.355c-5.583 0-10.124 4.54-10.128 10.124-.001 1.94.504 3.836 1.465 5.432l-1.012 3.7 3.791-.994zm13.067-6.308c-.287-.143-1.695-.837-1.957-.932-.262-.095-.453-.143-.644.143-.191.286-.74.932-.907 1.123-.167.19-.334.214-.62.071-1.285-.642-2.13-1.164-2.986-2.628-.227-.389.227-.361.649-1.205.07-.143.035-.268-.018-.375-.053-.107-.453-1.09-.62-1.498-.162-.39-.328-.337-.452-.343-.117-.005-.25-.006-.382-.006-.133 0-.35.05-.533.25-.183.2-.7.683-.7 1.666 0 .983.715 1.932.815 2.067.1.135 1.407 2.149 3.409 3.012 1.133.489 1.694.593 2.296.503.626-.094 1.695-.692 1.933-1.362.238-.67.238-1.243.167-1.362-.07-.12-.262-.215-.549-.357z"/>
              </svg>
            </Link>
            {/* Instagram */}
            <Link 
              href="https://www.instagram.com/al.parfumeco" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-800 hover:text-black hover:scale-110 transition-all duration-300"
              title="Instagram"
            >
              <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" />
              </svg>
            </Link>
            {/* TikTok */}
            <Link 
              href="https://www.tiktok.com/@alparfumeco?_r=1&_t=ZS-98RBwYcpSPB" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-800 hover:text-black hover:scale-110 transition-all duration-300"
              title="TikTok"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.82.12V9.4a6.34 6.34 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.83 4.47V12.1a8.3 8.3 0 0 0 5.76 2.27V10.9a4.83 4.83 0 0 1-3.76-1.74v-.01z"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Right Column: Payment & Shipping Methods (Strict 100% Monochrome Black & White) */}
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-14 items-start">
          
          {/* Payment Methods */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-900">
              Metode Pembayaran
            </h4>
            <div className="flex items-center gap-6 pt-1 select-none">
              {/* QRIS Logo */}
              <div className="flex items-baseline gap-0.5">
                <span className="font-black tracking-tighter text-lg text-black italic font-sans">
                  QRIS
                </span>
                <span className="text-[10px] font-normal text-neutral-500 not-italic ml-0.5">®</span>
              </div>

              {/* COD Logo */}
              <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-black fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
                </svg>
                <span className="font-black text-sm text-black tracking-widest">
                  COD
                </span>
              </div>
            </div>
          </div>

          {/* Shipping Methods */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-900">
              Metode Pengiriman
            </h4>
            <div className="flex flex-wrap items-center gap-6 pt-1 select-none">
              {/* JNE */}
              <div className="flex items-baseline gap-0.5">
                <span className="font-black text-base text-black italic tracking-tighter">JNE</span>
                <span className="font-bold text-[9px] text-neutral-700 italic">express</span>
              </div>

              {/* J&T */}
              <div className="flex items-baseline gap-1">
                <span className="font-black text-base text-black tracking-tighter">J&amp;T</span>
                <span className="font-bold text-[9px] text-neutral-500 tracking-wider">EXPRESS</span>
              </div>

              {/* SiCepat */}
              <div className="flex items-center">
                <span className="font-black text-base text-black italic tracking-tight">SiCEPAT</span>
                <span className="w-1 h-3 bg-black ml-1 transform skew-x-[-12deg]"></span>
              </div>

              {/* POS Indonesia */}
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-black tracking-wider uppercase">
                  POS INDONESIA
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Copyright Bar */}
      <div className="max-w-7xl mx-auto border-t border-neutral-200/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 font-light gap-2">
        <p>© {new Date().getFullYear()} AL PARFUME. All rights reserved.</p>
        <p className="tracking-wide">Madiun, Jawa Timur, Indonesia</p>
      </div>
    </footer>
  );
}
