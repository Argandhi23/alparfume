"use client";

import Link from "next/link";
import Image from "next/image";
import { Sun, Moon, ShoppingBag, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import SearchModal from "./SearchModal";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, targetId?: string) => {
    if (targetId && typeof window !== "undefined" && window.location.pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      setIsOpen(false);
    }
  };

  const menuItems: { label: string; href: string; targetId?: string; isExternal: boolean }[] = [
    { label: "WhatsApp", href: "https://wa.me/6281915931190", isExternal: true },
    { label: "TikTok", href: "https://www.tiktok.com/@alparfumeco?_r=1&_t=ZS-98RBwYcpSPB", isExternal: true },
    { label: "Instagram", href: "https://www.instagram.com/al.parfumeco", isExternal: true },
  ];

  return (
    <>
      <nav
        className="sticky top-0 z-50 transition-all duration-300 font-sans border-b"
        style={{
          backgroundColor: "var(--nav-bg)",
          color: "var(--nav-fg)",
          borderColor: "var(--nav-border)",
          paddingTop: isScrolled ? "0.85rem" : "1.25rem",
          paddingBottom: isScrolled ? "0.85rem" : "1.25rem",
          boxShadow: isScrolled ? "0 4px 20px -2px rgba(0, 0, 0, 0.2)" : "none",
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

          <div className="flex items-center space-x-4 md:space-x-6">
            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className={`p-2 rounded-full transition-all duration-300 ${
                isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
              }`}
              style={{ color: "var(--nav-fg)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--nav-hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Cari Produk"
              title="Cari Parfum"
            >
              <Search className="w-4 h-4" />
            </button>

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
              className={`p-2 rounded-full transition-all duration-300 ${
                isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
              }`}
              style={{ color: "var(--nav-fg)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--nav-hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Cart Icon */}
            <button
              onClick={() => setIsCartOpen(true)}
              className={`relative flex items-center p-2 rounded-full transition-all duration-300 ${
                isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100"
              }`}
              style={{ color: "var(--nav-fg)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--nav-hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Open Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItems > 0 && (
                <span
                  className="absolute top-0 right-0 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "var(--nav-fg)",
                    color: "var(--nav-bg)",
                  }}
                >
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2.5 rounded-full relative w-10 h-10 flex items-center justify-center z-50 transition-colors"
              style={{ color: "var(--nav-fg)" }}
              aria-label={isOpen ? "Close Menu" : "Open Menu"}
            >
              <div className="relative w-5 h-3 flex flex-col justify-between">
                <span
                  className={`block absolute w-full h-[1.5px] transition-all duration-300 ease-in-out ${
                    isOpen ? "top-[5px] rotate-45" : "top-[2px]"
                  }`}
                  style={{ backgroundColor: "var(--nav-fg)" }}
                />
                <span
                  className={`block absolute w-full h-[1.5px] transition-all duration-300 ease-in-out ${
                    isOpen ? "top-[5px] -rotate-45" : "top-[9px]"
                  }`}
                  style={{ backgroundColor: "var(--nav-fg)" }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Full Screen Menu Overlay */}
        <div
          className={`fixed inset-0 w-full h-screen z-40 md:hidden flex flex-col justify-start pt-28 px-8 transition-all duration-300 ease-in-out ${
            isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
          style={{
            backgroundColor: "var(--nav-bg)",
            color: "var(--nav-fg)",
          }}
        >
          <div className="flex flex-col space-y-6 mt-4">
            {menuItems.map((item, idx) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  setIsOpen(false);
                  if (!item.isExternal && item.targetId) {
                    scrollToSection(e, item.targetId);
                  }
                }}
                className={`flex items-center justify-between text-[26px] font-bold hover:opacity-75 transition-all duration-300 ${
                  isOpen ? "animate-slide-up" : "opacity-0"
                }`}
                style={{
                  color: "var(--nav-fg)",
                  animationDelay: `${idx * 60}ms`,
                  animationFillMode: "both",
                }}
              >
                <span>{item.label}</span>
                <ChevronRight className="w-6 h-6 stroke-[1.5]" style={{ color: "var(--nav-muted)" }} />
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Cart & Search Component Drawers */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
