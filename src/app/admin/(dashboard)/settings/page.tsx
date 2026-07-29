"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setSettingsEmail(data.user.email);
      }
    };
    fetchUser();
  }, []);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");

    if (settingsPassword && settingsPassword !== settingsConfirmPassword) {
      setSettingsError("Konfirmasi password tidak cocok!");
      return;
    }

    if (settingsPassword && settingsPassword.length < 6) {
      setSettingsError("Password minimal 6 karakter!");
      return;
    }

    setSettingsLoading(true);
    try {
      const updates: { email?: string; password?: string } = {};
      if (settingsEmail) updates.email = settingsEmail;
      if (settingsPassword) updates.password = settingsPassword;

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      setSettingsSuccess("Kredensial berhasil diperbarui!");
      setSettingsPassword("");
      setSettingsConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui kredensial";
      setSettingsError(msg);
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8 max-w-2xl mx-auto font-sans">
      <div className="space-y-1">
        <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">
          Pengaturan Akun Admin
        </h2>
        <p className="text-xs text-neutral-500">
          Ubah email login dan password untuk akun admin Anda.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <form onSubmit={handleUpdateCredentials} className="space-y-6">
          {settingsError && (
            <div className="border border-red-100 bg-red-50 p-3 rounded-lg text-xs text-center text-red-700 font-sans">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="border border-green-100 bg-green-50 p-3 rounded-lg text-xs text-center text-green-700 font-sans">
              {settingsSuccess}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold">
              Alamat Email Baru
            </label>
            <input
              type="email"
              value={settingsEmail}
              onChange={(e) => setSettingsEmail(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors text-neutral-800"
              placeholder="admin@alparfume.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold">
              Password Baru (Opsional)
            </label>
            <input
              type="password"
              value={settingsPassword}
              onChange={(e) => setSettingsPassword(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors text-neutral-800"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={settingsConfirmPassword}
              onChange={(e) => setSettingsConfirmPassword(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors text-neutral-800"
              placeholder="Ulangi password baru"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={settingsLoading}
              className="w-full bg-black text-white hover:bg-neutral-800 font-bold py-3 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {settingsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
