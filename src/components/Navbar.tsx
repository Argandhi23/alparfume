"use client";

import Link from "next/link";
import Image from "next/image";
import { Sun, Moon, ShoppingBag, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { totalItems } = useCart();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent background scroll when mobile menu is open and lock layout shift
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.scrollbarGutter = "stable";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.scrollbarGutter = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.scrollbarGutter = "";
    };
  }, [isOpen]);

  const menuItems = [
    { label: "Katalog", href: "/#koleksi", isExternal: false },
    { label: "About", href: "/#tentang", isExternal: false },
    { label: "Shopee", href: "https://shopee.co.id/al.parfumeco", isExternal: true },
    { label: "Instagram", href: "https://www.instagram.com/al.parfumeco", isExternal: true },
  ];

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 font-sans ${
          isScrolled
            ? "bg-brandWhite/95 backdrop-blur-md shadow-sm border-b border-brandBorder/50 py-4"
            : "bg-transparent border-b border-transparent py-6"
        }`}
        style={{
          backgroundColor: isOpen ? "transparent" : isScrolled ? "var(--background)" : "transparent",
          borderBottomColor: isOpen ? "transparent" : undefined,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Al Parfume"
              width={120}
              height={40}
              className="h-7 md:h-8 w-auto object-contain logo-img"
              priority
            />
          </Link>

          <div className="flex items-center space-x-6 md:space-x-8">
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-neutral-500 font-sans">
              <Link href="/#koleksi" className="hover:text-brandBlack transition-colors">
                Katalog
              </Link>
              <Link href="/#tentang" className="hover:text-brandBlack transition-colors">
                About
              </Link>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={(e) => {
                const x = e.clientX;
                const y = e.clientY;
                if (typeof document !== "undefined") {
                  document.documentElement.style.setProperty("--click-x", `${x}px`);
                  document.documentElement.style.setProperty("--click-y", `${y}px`);
                }
                toggleTheme();
              }}
              className={`text-brandBlack hover:opacity-75 transition-all p-2 hover:bg-brandGray rounded-full transition-all duration-300 ${
                isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
              }`}
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative text-brandBlack hover:opacity-75 transition-all flex items-center p-2 hover:bg-brandGray rounded-full transition-all duration-300 ${
                isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
              }`}
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-[var(--foreground)] text-[var(--background)] text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile hamburger (Apple style: 2 lines morphing into X) */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden text-brandBlack hover:opacity-75 transition-all p-2.5 hover:bg-brandGray rounded-full relative w-10 h-10 flex items-center justify-center z-50"
              aria-label={isOpen ? "Close Menu" : "Open Menu"}
            >
              <div className="relative w-5 h-3 flex flex-col justify-between">
                <span
                  className={`block absolute w-full h-[1px] bg-current transition-all duration-300 ease-in-out ${
                    isOpen ? "top-[5px] rotate-45" : "top-[2px]"
                  }`}
                />
                <span
                  className={`block absolute w-full h-[1px] bg-current transition-all duration-300 ease-in-out ${
                    isOpen ? "top-[5px] -rotate-45" : "top-[9px]"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Full Screen Menu Overlay */}
        <div
          className={`fixed inset-0 w-full h-screen bg-[var(--background)] z-40 md:hidden flex flex-col justify-start pt-28 px-8 transition-all duration-300 ease-in-out ${
            isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex flex-col space-y-6 mt-4">
            {menuItems.map((item, idx) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between text-[28px] font-bold text-[var(--foreground)] hover:opacity-75 transition-all duration-300 ${
                  isOpen ? "animate-slide-up" : "opacity-0"
                }`}
                style={{
                  animationDelay: `${idx * 60}ms`,
                  animationFillMode: "both",
                }}
              >
                <span>{item.label}</span>
                <ChevronRight className="w-6 h-6 text-neutral-400/80 stroke-[1.5]" />
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Cart Drawer Component */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
