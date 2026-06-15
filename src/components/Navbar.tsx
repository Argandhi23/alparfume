"use client";

import Link from "next/link";
import { Menu, X, Sun, Moon, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import Logo from "./Logo";

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

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 font-sans border-b ${
          isScrolled
            ? "bg-brandWhite/95 backdrop-blur-md shadow-sm border-brandBorder/50 py-4"
            : "bg-transparent border-transparent py-6"
        }`}
        style={{
          backgroundColor: isScrolled ? "var(--bg)" : "transparent",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
          >
            <Logo horizontal />
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
              className="text-brandBlack hover:opacity-75 transition-all p-2 hover:bg-brandGray rounded-full"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative text-brandBlack hover:opacity-75 transition-all flex items-center p-2 hover:bg-brandGray rounded-full"
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-[var(--foreground)] text-[var(--background)] text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(true)}
              className="md:hidden text-brandBlack hover:opacity-75 transition-all p-2 hover:bg-brandGray rounded-full"
              aria-label="Open Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Overlay Menu Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Overlay Menu Sliding Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-xs bg-brandWhite border-l border-brandBorder shadow-2xl flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-brandBorder">
          <span className="text-sm font-semibold tracking-wider text-brandBlack uppercase">
            Menu
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="text-brandMuted hover:text-brandBlack transition-colors p-1.5 hover:bg-brandGray rounded-full"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col p-8 space-y-6">
          <Link
            href="/#koleksi"
            onClick={() => setIsOpen(false)}
            className="text-lg font-medium hover:opacity-70 transition-opacity text-brandBlack"
          >
            Katalog
          </Link>
          <Link
            href="/#tentang"
            onClick={() => setIsOpen(false)}
            className="text-lg font-medium hover:opacity-70 transition-opacity text-brandBlack"
          >
            About
          </Link>
        </div>
      </div>

      {/* Cart Drawer Component */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
