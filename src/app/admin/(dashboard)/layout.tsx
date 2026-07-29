"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, FileText, RefreshCw, ImageIcon, ArrowLeft, Settings, LogOut, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) router.replace("/admin/login");
        } else {
          if (mounted) setChecking(false);
        }
      } catch (error) {
        console.error("Auth error:", error);
        if (mounted) router.replace("/admin/login");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.replace("/admin/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace("/admin/login");
    } catch (err) {
      console.error("Gagal logout:", err);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  const navItems = [
    { name: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Daftar Pesanan", path: "/admin/orders", icon: FileText },
    { name: "Kelola Produk", path: "/admin/products", icon: RefreshCw },
    { name: "Kategori & Banner", path: "/admin/categories", icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans flex flex-col md:flex-row">
      {/* Fixed Left Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-neutral-950 text-white flex-shrink-0 flex flex-col justify-between border-r border-neutral-800/80 shadow-2xl z-30 md:h-screen md:sticky md:top-0 overflow-y-auto">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-neutral-800/80 flex flex-col items-center justify-center gap-3">
            <div className="w-32 h-auto relative">
              <Image 
                src="/logo.png" 
                alt="Alparfume Logo" 
                width={200}
                height={60}
                className="object-contain filter invert brightness-0" 
              />
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 font-sans">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-white text-black shadow-md font-extrabold"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-neutral-800/80 space-y-2 font-sans">
          <Link
            href="/"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-900 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Lihat Website</span>
          </Link>

          <Link
            href="/admin/settings"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-900 transition-all"
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan Akun</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
