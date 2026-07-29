"use client";

import { useState, useEffect } from "react";
import { X, QrCode, Store, Truck, MapPin, Phone, User, ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import { supabase, ProductWithVariants, ProductVariant } from "@/lib/supabase";
import { useRouter } from "next/navigation";

import { CartItem } from "@/context/CartContext";

interface CheckoutModalProps {
  product?: ProductWithVariants;
  selectedVariant?: ProductVariant;
  quantity?: number;
  cartItems?: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}





interface RegionOption {
  province_id?: string;
  province?: string;
  city_id?: string;
  city_name?: string;
  type?: string;
  postal_code?: string;
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface CourierOption {
  id: string;
  name: string;
  est: string;
  cost: number;
}

const DEFAULT_COURIERS: CourierOption[] = [
  { id: "jne", name: "JNE Regular", est: "2-3 Hari", cost: 12000 },
  { id: "jnt", name: "J&T Express", est: "1-2 Hari", cost: 14000 },
  { id: "sicepat", name: "SiCepat REG", est: "2-3 Hari", cost: 11000 },
  { id: "pos", name: "POS Kilat Khusus", est: "3-4 Hari", cost: 10000 },
];

export function CheckoutModal({
  product,
  selectedVariant,
  quantity = 1,
  cartItems,
  isOpen,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const router = useRouter();

  // Delivery & Customer State
  const [deliveryMethod, setDeliveryMethod] = useState<"courier" | "pickup">("courier");
  const [customerName, setCustomerName] = useState("");
  const [customerWa, setCustomerWa] = useState("");
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<RegionOption[]>([]);
  
  const [selectedProvince, setSelectedProvince] = useState<RegionOption | null>(null);
  const [cityDistrict, setCityDistrict] = useState<RegionOption | null>(null);
  const [selectedKecamatan, setSelectedKecamatan] = useState<RegionOption | null>(null);

  useEffect(() => {
    fetch("/api/shipping/regions?type=provinces")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProvinces(d); });
  }, []);
  const [customerAddress, setCustomerAddress] = useState("");
  const [courierOptions, setCourierOptions] = useState<CourierOption[]>(DEFAULT_COURIERS);
  const [selectedCourier, setSelectedCourier] = useState<CourierOption>(DEFAULT_COURIERS[0]);
  const [calculatingOngkir, setCalculatingOngkir] = useState(false);
  const [, setIsLiveApi] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "cod_pickup">("qris");
  const [submitting, setSubmitting] = useState(false);

  const handleProvinceChange = (provId: string) => {
    const prov = provinces.find(p => p.province_id === provId || p.id === provId);
    setSelectedProvince(prov || null);
    setCityDistrict(null);
    setSelectedKecamatan(null);
    setCities([]);
    setSubdistricts([]);
    if (provId) {
      const provName = prov?.province || prov?.name || "";
      fetch(`/api/shipping/regions?type=cities&province_id=${provId}&province_name=${encodeURIComponent(provName)}`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setCities(d); });
    }
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find(c => c.city_id === cityId || c.id === cityId);
    setCityDistrict(city || null);
    setSelectedKecamatan(null);
    setSubdistricts([]);
    if (city && selectedProvince) {
      const provName = selectedProvince.province || selectedProvince.name || "";
      const cityName = city.city_name || city.name || "";
      fetch(`/api/shipping/regions?type=subdistricts&city_id=${cityId}&province_id=${selectedProvince.province_id || selectedProvince.id}&province_name=${encodeURIComponent(provName)}&city_name=${encodeURIComponent(cityName)}`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setSubdistricts(d); });
    }
  };

  // Auto calculate ongkir whenever selectedProvince, cityDistrict, or selectedKecamatan changes
  useEffect(() => {
    if (deliveryMethod !== "courier") return;
    if (!selectedProvince || !cityDistrict || !selectedKecamatan) return;

    const timer = setTimeout(async () => {
      setCalculatingOngkir(true);
      try {
        const res = await fetch("/api/shipping/cost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            province: selectedProvince?.province || selectedProvince?.name, 
            city: cityDistrict?.city_name || cityDistrict?.name, 
            cityId: cityDistrict?.city_id || cityDistrict?.id,
            district: selectedKecamatan?.name 
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rates)) {
            setCourierOptions(data.rates);
            setIsLiveApi(!!data.is_live_api);
            setSelectedCourier((prev) => data.rates.find((c: CourierOption) => c.id === prev.id) || data.rates[0]);
          }
        }
      } catch (err) {
        console.error("Gagal ambil ongkir otomatis:", err);
      } finally {
        setCalculatingOngkir(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedProvince, cityDistrict, selectedKecamatan, deliveryMethod]);

  if (!isOpen) return null;

  const isCartMode = !!cartItems && cartItems.length > 0;
  const itemTotal = isCartMode
    ? cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
    : (selectedVariant?.price || 0) * quantity;
  const shippingCost = deliveryMethod === "pickup" ? 0 : selectedCourier.cost;
  const grandTotal = itemTotal + shippingCost;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!customerName.trim() || !customerWa.trim()) {
        alert("Mohon lengkapi Nama dan Nomor WhatsApp Anda.");
        setSubmitting(false);
        return;
      }

      if (deliveryMethod === "courier" && (!customerAddress.trim() || !cityDistrict)) {
        alert("Mohon lengkapi Alamat Lengkap dan Kota/Kecamatan Pengiriman.");
        setSubmitting(false);
        return;
      }

      const fullAddressString =
        deliveryMethod === "pickup"
          ? "AMBIL DI TOKO (COD)"
          : `${customerAddress.trim()}, Kec. ${selectedKecamatan?.name || "-"}, ${cityDistrict?.type || ""} ${cityDistrict?.city_name || "-"}, ${selectedProvince?.province || "-"}`;

      const courierNameString = deliveryMethod === "pickup" ? "Ambil di Toko" : selectedCourier.name;

      const finalProductName = isCartMode
        ? (cartItems.length === 1 ? cartItems[0].productName : `${cartItems[0].productName} + ${cartItems.length - 1} lainnya`)
        : product?.name || "";

      const finalSizeMl = isCartMode ? cartItems[0].sizeMl : selectedVariant?.size_ml || 0;

      const itemsList = isCartMode
        ? cartItems.map(item => ({
            productName: item.productName,
            sizeMl: item.sizeMl,
            quantity: item.quantity,
            price: item.price
          }))
        : [
            {
              productName: product?.name || "",
              sizeMl: selectedVariant?.size_ml || 0,
              quantity: quantity,
              price: selectedVariant?.price || 0,
            }
          ];

      const cleanPayload = {
        product_name: finalProductName,
        size_ml: finalSizeMl,
        price: grandTotal,
        customer_name: customerName.trim(),
        customer_wa: customerWa.trim(),
        customer_address: fullAddressString,
        order_notes: orderNotes.trim() || null,
        items_json: JSON.stringify({
          delivery_method: deliveryMethod,
          courier_name: courierNameString,
          shipping_cost: shippingCost,
          grand_total: grandTotal,
          payment_method: paymentMethod,
          payment_status: paymentMethod === "qris" ? "pending_verification" : "cod_pickup",
          fulfillment_status: "pending",
          tracking_number: null,
          items: itemsList,
        }),
      };

      let finalOrderId: number | null = null;

      try {
        const createRes = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanPayload }),
        });

        if (createRes.ok) {
          const resJson = await createRes.json();
          if (resJson.data?.id) {
            finalOrderId = resJson.data.id;
          }
        }
      } catch (apiErr) {
        console.warn("API create order notice, falling back to direct client:", apiErr);
      }

      if (!finalOrderId) {
        const { data, error } = await supabase
          .from("order_intents")
          .insert([cleanPayload])
          .select()
          .single();

        if (error) {
          console.error("Gagal menyimpan pesanan ke Supabase:", error);
        } else if (data?.id) {
          finalOrderId = data.id;
        }
      }

      // Decrement product stock
      try {
        const itemsToDecrement = isCartMode
          ? cartItems.map(item => ({ slug: item.productSlug, qty: item.quantity }))
          : [{ slug: product?.slug, qty: quantity }];

        for (const item of itemsToDecrement) {
          if (!item.slug) continue;
          const { data: prodData } = await supabase
            .from("products")
            .select("stock")
            .eq("slug", item.slug)
            .single();

          if (prodData && typeof prodData.stock === "number") {
            const nextStock = Math.max(0, prodData.stock - item.qty);
            await supabase
              .from("products")
              .update({ stock: nextStock })
              .eq("slug", item.slug);
          }
        }
      } catch (stockErr) {
        console.error("Gagal mengurangi stok:", stockErr);
      }

      const orderIdToUse = finalOrderId || Date.now();

      // Save order info locally for instant customer tracking receipt
      const localOrderReceipt = {
        id: orderIdToUse,
        product_name: finalProductName,
        size_ml: finalSizeMl,
        quantity: isCartMode ? cartItems.reduce((acc, curr) => acc + curr.quantity, 0) : quantity,
        price: isCartMode ? itemTotal : (selectedVariant?.price || 0),
        grandTotal,
        shippingCost,
        courierName: courierNameString,
        customerName: customerName.trim(),
        customerWa: customerWa.trim(),
        customerAddress: fullAddressString,
        paymentMethod,
        paymentStatus: paymentMethod === "qris" ? "pending_verification" : "cod_pickup",
        trackingNumber: null,
        createdAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(`alparfume_order_${orderIdToUse}`, JSON.stringify(localOrderReceipt));
      } catch {
        // Ignore quota limits
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
      router.push(`/orders/${orderIdToUse}`);
    } catch (err) {
      console.error("Order submission error:", err);
      alert("Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-white border border-neutral-100 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <span className="text-[10px] tracking-[0.2em] font-bold text-neutral-400 uppercase block font-sans">
              Checkout & Pembayaran
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 font-sans">
              Detail Pesanan
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Item Summary */}
        <div className="space-y-3">
          {isCartMode ? (
            cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="relative w-16 h-16 bg-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-bold uppercase">AL</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-neutral-900 uppercase font-sans truncate">{item.productName}</h4>
                  <p className="text-xs text-neutral-500 font-sans">Varian {item.sizeMl} ml &bull; {item.quantity}x</p>
                  <p className="text-sm font-bold text-black font-sans mt-0.5">{formatRupiah(item.price * item.quantity)}</p>
                </div>
              </div>
            ))
          ) : (
            product && selectedVariant && (
              <div className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="relative w-16 h-16 bg-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <Image
                      src={
                        product.image_url.startsWith("[")
                          ? JSON.parse(product.image_url)[0]
                          : product.image_url
                      }
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-bold uppercase">
                      AL
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-neutral-900 uppercase font-sans truncate">
                    {product.name}
                  </h4>
                  <p className="text-xs text-neutral-500 font-sans">
                    Varian {selectedVariant.size_ml} ml &bull; {quantity}x
                  </p>
                  <p className="text-sm font-bold text-black font-sans mt-0.5">
                    {formatRupiah(itemTotal)}
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Section 1: Customer Info */}
          <div className="space-y-4">
            <span className="text-xs tracking-wider text-neutral-400 uppercase font-bold block font-sans">
              1. Informasi Pemesan
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 block flex items-center gap-1.5 font-sans">
                  <User className="w-3.5 h-3.5 text-neutral-400" /> Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-brandBlack focus:outline-none focus:border-black font-sans"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 block flex items-center gap-1.5 font-sans">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" /> WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={customerWa}
                  onChange={(e) => setCustomerWa(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-brandBlack focus:outline-none focus:border-black font-sans"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 block font-sans">
                Catatan Pesanan (Opsional)
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Contoh: Tambah kartu ucapan / pesan wangi terlaris..."
                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs text-brandBlack focus:outline-none focus:border-black font-sans"
              />
            </div>
          </div>

          {/* Section 2: Delivery Method */}
          <div className="space-y-4 border-t border-neutral-100 pt-5">
            <span className="text-xs tracking-wider text-neutral-400 uppercase font-bold block font-sans">
              2. Pengiriman
            </span>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeliveryMethod("courier");
                  setPaymentMethod("qris");
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all font-sans cursor-pointer ${
                  deliveryMethod === "courier"
                    ? "border-black bg-neutral-900 text-white shadow-md"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <Truck className="w-5 h-5" />
                <div>
                  <div className="font-bold text-xs">Kurir Ekspedisi</div>
                  <div className="text-[10px] opacity-80">Tarif Akurat s/d Kecamatan</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryMethod("pickup");
                  setPaymentMethod("cod_pickup");
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all font-sans cursor-pointer ${
                  deliveryMethod === "pickup"
                    ? "border-black bg-neutral-900 text-white shadow-md"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <Store className="w-5 h-5" />
                <div>
                  <div className="font-bold text-xs">Ambil di Toko (COD)</div>
                  <div className="text-[10px] opacity-80">Bebas Ongkir &bull; Bayar di Toko</div>
                </div>
              </button>
            </div>

            {/* Courier 3-Tier Address: Province -> City -> Subdistrict */}
            {deliveryMethod === "courier" ? (
              <div className="space-y-3.5 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700 block font-sans">
                      Provinsi
                    </label>
                    <select
                      required
                      value={selectedProvince?.province_id || selectedProvince?.id || ""}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-brandBlack focus:outline-none focus:border-black font-sans appearance-none"
                    >
                      <option value="" disabled>Pilih Provinsi...</option>
                      {provinces.map((prov) => {
                        const id = prov.province_id || prov.id || "";
                        const name = prov.province || prov.name || "";
                        return <option key={id} value={id}>{name}</option>;
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700 block font-sans">
                      Kota / Kabupaten
                    </label>
                    <select
                      required
                      value={cityDistrict?.city_id || cityDistrict?.id || ""}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={!selectedProvince || cities.length === 0}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-brandBlack focus:outline-none focus:border-black font-sans appearance-none disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      <option value="" disabled>Pilih Kota/Kab...</option>
                      {cities.map((c) => {
                        const id = c.city_id || c.id || "";
                        const name = c.name || (c.type ? `${c.type} ${c.city_name}` : c.city_name) || "";
                        return <option key={id} value={id}>{name}</option>;
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-700 block font-sans">
                      Kecamatan
                    </label>
                    <select
                      required
                      value={selectedKecamatan?.id || ""}
                      onChange={(e) => {
                        const dist = subdistricts.find(d => d.id === e.target.value);
                        setSelectedKecamatan(dist || null);
                      }}
                      disabled={!cityDistrict || subdistricts.length === 0}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-brandBlack focus:outline-none focus:border-black font-sans appearance-none disabled:bg-neutral-100 disabled:text-neutral-400"
                    >
                      <option value="" disabled>Pilih Kecamatan...</option>
                      {subdistricts.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 block flex items-center gap-1.5 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" /> Alamat Lengkap (Jalan / Nomor Rumah / RT RW)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Nama Jalan, Nomor Rumah, RT/RW, Patokan..."
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-brandBlack focus:outline-none focus:border-black font-sans resize-none"
                  />
                </div>

                {/* Auto Calculated Courier Rates List */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-800 font-sans">
                      Tarif Ekspedisi (Kec. {selectedKecamatan?.name || cityDistrict?.city_name || cityDistrict?.name || "-"})
                    </label>
                    {calculatingOngkir && (
                      <span className="text-[10px] text-neutral-500 font-sans flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-black" /> Memeriksa...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {courierOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCourier(c)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all font-sans cursor-pointer ${
                          selectedCourier.id === c.id
                            ? "border-black bg-black text-white font-bold shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <div>
                          <div className="text-xs">{c.name}</div>
                          <div className="text-[9px] opacity-75">{c.est}</div>
                        </div>
                        <div className="text-xs font-bold">{formatRupiah(c.cost)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-1">
                <div className="text-xs font-bold text-amber-900 font-sans flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-700" /> Alamat Pengambilan Toko:
                </div>
                <p className="text-xs text-amber-800 font-sans leading-relaxed">
                  Toko Al Parfume Official &bull; Silakan konfirmasi jam pengambilan via WhatsApp setelah melakukan order.
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Payment Method */}
          <div className="space-y-4 border-t border-neutral-100 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-wider text-neutral-400 uppercase font-bold block font-sans">
                3. Metode Pembayaran
              </span>
              {deliveryMethod === "courier" && (
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full font-sans">
                  Kurir: Hanya QRIS
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("qris")}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all font-sans cursor-pointer ${
                  paymentMethod === "qris"
                    ? "border-black bg-neutral-900 text-white shadow-md"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <QrCode className="w-5 h-5" />
                <div>
                  <div className="font-bold text-xs">QRIS (Transfer QR)</div>
                  <div className="text-[10px] opacity-80">BCA / Mandiri / GoPay / ShopeePay</div>
                </div>
              </button>

              <button
                type="button"
                disabled={deliveryMethod === "courier"}
                onClick={() => {
                  if (deliveryMethod === "pickup") {
                    setPaymentMethod("cod_pickup");
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all font-sans ${
                  deliveryMethod === "courier"
                    ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-60"
                    : paymentMethod === "cod_pickup"
                    ? "border-black bg-neutral-900 text-white shadow-md cursor-pointer"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 cursor-pointer"
                }`}
              >
                <Store className="w-5 h-5" />
                <div>
                  <div className="font-bold text-xs">Bayar di Tempat (COD)</div>
                  <div className="text-[10px] opacity-80">
                    {deliveryMethod === "courier" ? "Khusus Ambil di Toko" : "Bayar Tunai saat Ambil di Toko"}
                  </div>
                </div>
              </button>
            </div>

            {/* QRIS Info Note */}
            {paymentMethod === "qris" && (
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-neutral-900 font-sans">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  Pembayaran via QRIS (Transfer QR / E-Wallet)
                </div>
                <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                  Setelah menekan tombol <strong>Proses Pesanan Sekarang</strong>, Anda akan langsung diarahkan ke halaman invoice untuk memindai kode QRIS dan mengunggah bukti pembayaran.
                </p>
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="border-t border-neutral-100 pt-4 space-y-2 font-sans text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal Produk</span>
              <span className="font-semibold text-neutral-900">{formatRupiah(itemTotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Ongkos Kirim ({deliveryMethod === "pickup" ? "Ambil di Toko" : selectedCourier.name})</span>
              <span className="font-semibold text-neutral-900">
                {shippingCost === 0 ? "GRATIS" : formatRupiah(shippingCost)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-black border-t border-dashed border-neutral-200 pt-2">
              <span>Total Pembayaran</span>
              <span>{formatRupiah(grandTotal)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black hover:bg-neutral-800 text-white py-3.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses Pesanan...
              </>
            ) : (
              <>
                Proses Pesanan Sekarang
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
