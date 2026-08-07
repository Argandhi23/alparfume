"use client";

import React from "react";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import { useCart, CartItem } from "@/context/CartContext";
import { formatRupiah } from "@/lib/whatsapp";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { sanitizeImageUrl } from "@/lib/imageHelper";

interface CartItemRowProps {
  item: CartItem;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
}

function CartItemRow({ item, updateQuantity, removeFromCart }: CartItemRowProps) {
  const [imgError, setImgError] = React.useState(false);
  const imgUrl = sanitizeImageUrl(item.imageUrl);

  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="flex gap-4 border-b border-brandBorder pb-6 last:border-0 last:pb-0">
      <div className="relative w-20 h-20 bg-brandGray border border-brandBorder flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
        {imgUrl && !imgError ? (
          <Image
            src={imgUrl}
            alt={item.productName}
            fill
            sizes="80px"
            onError={() => setImgError(true)}
            className="object-cover"
            priority
          />
        ) : (
          <div className="text-[10px] text-neutral-400 font-bold">AL</div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-plus-jakarta text-sm font-semibold text-brandBlack">
            {toTitleCase(item.productName)}
          </h4>
          <p className="text-xs text-brandMuted mt-0.5">Ukuran: {item.sizeMl}ml</p>
          <p className="text-xs font-semibold text-brandBlack mt-1 font-sans">
            {formatRupiah(item.price)}
          </p>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center border border-brandBorder rounded-full overflow-hidden">
            <button
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              className="p-1 hover:bg-brandGray transition-colors text-brandMuted hover:text-brandBlack rounded-full"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2 text-xs font-medium font-sans">{item.quantity}</span>
            <button
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              className="p-1 hover:bg-brandGray transition-colors text-brandMuted hover:text-brandBlack rounded-full"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => removeFromCart(item.id)}
            className="text-brandMuted hover:text-red-500 transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart();

  const handleCheckoutClick = () => {
    onClose();
    router.push("/checkout");
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
              <CartItemRow
                key={item.id}
                item={item}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />
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
              onClick={handleCheckoutClick}
              className="w-full bg-brandBlack text-brandWhite hover:opacity-90 py-3 text-sm font-medium transition-all duration-200 rounded-full font-sans"
            >
              Checkout Sekarang
            </button>
          </div>
        )}
      </div>
    </>
  );
}
