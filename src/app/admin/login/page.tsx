"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/admin/dashboard");
      } else {
        setChecking(false);
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message);
      } else {
        router.push("/admin/dashboard");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan sistem. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-brandGray text-brandBlack flex items-center justify-center font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center px-6 font-sans relative">
      {/* Back to Website Button */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-2 border border-neutral-200 px-5 py-2 text-xs uppercase tracking-wider font-medium rounded-full transition-colors duration-200 text-neutral-700 bg-white hover:bg-neutral-50 font-sans shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Website
        </Link>
      </div>

      <div className="w-full max-w-sm border border-neutral-100 rounded-2xl bg-white p-8 space-y-8 shadow-sm">
        <div className="text-center space-y-2">
          <span className="text-xs font-semibold tracking-[0.3em] text-neutral-400 uppercase font-sans">
            AL PARFUME
          </span>
          <h1 className="font-plus-jakarta text-2xl font-bold text-neutral-900 leading-tight">
            Admin Login
          </h1>
          <p className="text-xs text-neutral-400 font-sans">
            Masuk untuk mengelola produk Al Parfume
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {errorMsg && (
            <div className="border border-red-100 bg-red-50 p-3 rounded-lg text-xs text-center text-red-700 font-sans">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold font-sans">
              Alamat Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 focus:ring-0 text-brandBlack transition-colors font-sans"
              placeholder="admin@alparfume.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold font-sans">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 focus:ring-0 text-brandBlack transition-colors font-sans"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white font-medium text-xs uppercase tracking-widest py-3.5 rounded-full hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-sans"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
