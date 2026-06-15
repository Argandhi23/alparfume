"use client";

import React, { useState } from "react";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatRupiah } from "@/lib/whatsapp";
import OrderFormModal from "./OrderFormModal";
import Image from "next/image";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const handleOrderSuccess = () => {
    clearCart();
    onClose();
  };

  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-brandWhite border-l border-brandBorder shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-brandBorder flex justify-between items-center">
          <h3 className="font-plus-jakarta text-lg font-bold text-brandBlack">
            Keranjang Belanja
          </h3>
          <button
            onClick={onClose}
            className="text-brandMuted hover:text-brandBlack transition-colors p-1.5 hover:bg-brandGray rounded-full"
            aria-label="Tutup keranjang"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <span className="font-plus-jakarta text-base text-brandMuted font-medium">
                Keranjang Anda kosong
              </span>
              <button
                onClick={onClose}
                className="border border-brandBlack text-brandBlack hover:bg-brandBlack hover:text-brandWhite transition-colors duration-200 px-6 py-2.5 text-sm font-medium rounded-full font-sans"
              >
                Lanjut Belanja
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 border-b border-brandBorder pb-6 last:border-0 last:pb-0"
              >
                <div className="relative w-20 h-20 bg-brandGray border border-brandBorder flex-shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                    priority
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-plus-jakarta text-sm font-semibold text-brandBlack">
                      {toTitleCase(item.productName)}
                    </h4>
                    <p className="text-xs text-brandMuted mt-0.5">
                      Ukuran: {item.sizeMl}ml
                    </p>
                    <p className="text-xs font-semibold text-brandBlack mt-1 font-sans">
                      {formatRupiah(item.price)}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center border border-brandBorder rounded-full overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:bg-brandGray transition-colors text-brandMuted hover:text-brandBlack rounded-full"
                        aria-label="Kurangi jumlah"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-semibold text-brandBlack w-8 text-center font-sans">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:bg-brandGray transition-colors text-brandMuted hover:text-brandBlack rounded-full"
                        aria-label="Tambah jumlah"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-brandMuted hover:text-red-500 transition-colors"
                      aria-label="Hapus item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info & action */}
        {items.length > 0 && (
          <div className="p-6 border-t border-brandBorder bg-brandGray">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs uppercase tracking-wider text-brandMuted font-medium">
                Subtotal
              </span>
              <span className="text-lg font-bold text-brandBlack font-sans">
                {formatRupiah(totalPrice)}
              </span>
            </div>

            <button
              onClick={() => setIsOrderModalOpen(true)}
              className="w-full bg-brandBlack text-brandWhite hover:opacity-90 py-3 text-sm font-medium transition-all duration-200 rounded-full font-sans"
            >
              Pesan via WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Order Validation Form Modal */}
      {isOrderModalOpen && (
        <OrderFormModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          items={items}
          totalPrice={totalPrice}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  );
}
