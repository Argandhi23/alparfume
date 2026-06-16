"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { CartItem } from "@/context/CartContext";

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onSuccess?: () => void;
}

export default function OrderFormModal({
  isOpen,
  onClose,
  items,
  totalPrice,
  onSuccess,
}: OrderFormModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    address?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = "Nama lengkap wajib diisi";
    }
    if (!phone.trim()) {
      newErrors.phone = "Nomor WhatsApp wajib diisi";
    } else if (!/^(08|628)\d{8,12}$/.test(phone.trim())) {
      newErrors.phone = "Nomor WhatsApp harus diawali 08 atau 628 (10-14 digit)";
    }
    if (!address.trim()) {
      newErrors.address = "Alamat pengiriman wajib diisi";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Detect mobile or Safari to decide redirection method
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const useRedirect = isMobile || isSafari;

    let newWindow: Window | null = null;
    if (!useRedirect) {
      // Synchronously open a blank window for desktop non-Safari to bypass popup blocker
      newWindow = window.open("", "_blank");
    }

    setLoading(true);

    try {
      const isCart = items.length > 1;
      const productName = isCart ? "Multiple items" : items[0].productName;
      const sizeMl = isCart ? 0 : items[0].sizeMl;

      // 1. Insert to supabase order_intents
      const { error } = await supabase.from("order_intents").insert([
        {
          product_name: productName,
          size_ml: sizeMl,
          price: totalPrice,
          customer_name: name.trim(),
          customer_wa: phone.trim(),
          customer_address: address.trim(),
          order_notes: notes.trim() || null,
          items_json: JSON.stringify(items),
        },
      ]);

      if (error) throw error;

      // 2. Generate WhatsApp message
      let itemsList = "";
      items.forEach((item) => {
        itemsList += `- ${item.productName} ${item.sizeMl}ml × ${item.quantity} = ${formatRupiah(
          item.price * item.quantity
        )}\n`;
      });

      const waMessage = `Halo Al Parfume! Saya ingin memesan:\n\n${itemsList}\nTotal: ${formatRupiah(
        totalPrice
      )}\n\nData Pemesan:\nNama: ${name.trim()}\nNo. WA: ${phone.trim()}\nAlamat: ${address.trim()}${
        notes.trim() ? `\n\nCatatan: ${notes.trim()}` : ""
      }\n\nMohon konfirmasi ketersediaan dan estimasi pengiriman. Terima kasih! 🙏`;

      const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281915931190";
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

      if (onSuccess) {
        onSuccess();
      }

      onClose();

      // Redirect to WhatsApp
      if (newWindow) {
        newWindow.location.href = waUrl;
      } else {
        window.location.href = waUrl;
      }
    } catch (err) {
      if (newWindow) {
        newWindow.close();
      }
      console.error("Failed to submit order:", err);
      alert("Gagal memproses pesanan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-brandWhite border border-brandBorder p-8 shadow-xl relative animate-slide-up rounded-lg">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-brandMuted hover:text-brandBlack transition-colors p-1.5 hover:bg-brandGray rounded-full"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-plus-jakarta text-xl font-bold text-brandBlack mb-6">
          Formulir Pemesanan
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-brandMuted mb-2 font-medium">
              Nama Lengkap *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-brandWhite border border-brandBorder px-4 py-2.5 text-sm text-brandBlack focus:outline-none focus:border-brandBlack transition-colors font-sans rounded-lg"
              placeholder="Masukkan nama lengkap Anda"
            />
            {errors.name && (
              <span className="text-red-500 text-xs mt-1 block">{errors.name}</span>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-brandMuted mb-2 font-medium">
              Nomor WhatsApp *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-brandWhite border border-brandBorder px-4 py-2.5 text-sm text-brandBlack focus:outline-none focus:border-brandBlack transition-colors font-sans rounded-lg"
              placeholder="Contoh: 081915931190"
            />
            {errors.phone && (
              <span className="text-red-500 text-xs mt-1 block">{errors.phone}</span>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-brandMuted mb-2 font-medium">
              Alamat Pengiriman *
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full bg-brandWhite border border-brandBorder px-4 py-2.5 text-sm text-brandBlack focus:outline-none focus:border-brandBlack transition-colors resize-none leading-relaxed font-sans rounded-lg"
              placeholder="Tulis alamat lengkap pengiriman"
            />
            {errors.address && (
              <span className="text-red-500 text-xs mt-1 block">{errors.address}</span>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-brandMuted mb-2 font-medium">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-brandWhite border border-brandBorder px-4 py-2.5 text-sm text-brandBlack focus:outline-none focus:border-brandBlack transition-colors resize-none leading-relaxed font-sans rounded-lg"
              placeholder="Catatan mengenai pengiriman atau aroma"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brandBlack text-brandWhite hover:opacity-90 disabled:opacity-50 py-3 text-sm font-medium transition-all duration-200 rounded-full font-sans"
            >
              {loading ? "Memproses..." : "Pesan via WhatsApp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
