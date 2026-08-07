"use client";

import { useState, useEffect } from "react";
import {
  Store,
  Truck,
  User,
  Phone,
  ArrowRight,
  Loader2,
  ArrowLeft,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  QrCode,
  FileText,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, CartItem } from "@/context/CartContext";
import { supabase, ProductWithVariants, ProductVariant } from "@/lib/supabase";
import { sanitizeImageUrl } from "@/lib/imageHelper";

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

export function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items: cartItems, clearCart } = useCart();

  // Direct buy parameter support from URL query string fallback
  const directProductSlug = searchParams.get("slug");
  const directSizeMl = searchParams.get("size") ? Number(searchParams.get("size")) : null;
  const directQty = searchParams.get("qty") ? Number(searchParams.get("qty")) : 1;

  const [directProduct, setDirectProduct] = useState<ProductWithVariants | null>(null);
  const [directVariant, setDirectVariant] = useState<ProductVariant | null>(null);
  const [loadingDirectProduct, setLoadingDirectProduct] = useState(!!directProductSlug);

  // Fetch direct product if requested via query string and cart is empty
  useEffect(() => {
    if (directProductSlug && cartItems.length === 0) {
      setLoadingDirectProduct(true);
      (async () => {
        try {
          const { data } = await supabase
            .from("products")
            .select("*, product_variants(*)")
            .eq("slug", directProductSlug)
            .single();

          if (data) {
            setDirectProduct(data as ProductWithVariants);
            const foundVariant =
              data.product_variants?.find((v: ProductVariant) => v.size_ml === directSizeMl) ||
              data.product_variants?.[0];
            setDirectVariant(foundVariant || null);
          }
        } catch (err) {
          console.error("Fetch direct product error:", err);
        } finally {
          setLoadingDirectProduct(false);
        }
      })();
    }
  }, [directProductSlug, directSizeMl, cartItems.length]);

  const isCartMode = cartItems.length > 0 || !directProduct;
  const checkoutItems: CartItem[] = isCartMode
    ? cartItems
    : directProduct && directVariant
    ? [
        {
          id: `${directProduct.slug}-${directVariant.size_ml}`,
          productName: directProduct.name,
          productSlug: directProduct.slug,
          imageUrl: directProduct.image_url
            ? directProduct.image_url.startsWith("[")
              ? JSON.parse(directProduct.image_url)[0]
              : directProduct.image_url
            : "",
          sizeMl: directVariant.size_ml,
          price: directVariant.price,
          quantity: directQty,
        },
      ]
    : [];

  // Delivery & Customer Form State
  const [deliveryMethod, setDeliveryMethod] = useState<"courier" | "pickup">("courier");
  const [customerName, setCustomerName] = useState("");
  const [customerWa, setCustomerWa] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // Region State
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [subdistricts, setSubdistricts] = useState<RegionOption[]>([]);

  const [selectedProvince, setSelectedProvince] = useState<RegionOption | null>(null);
  const [cityDistrict, setCityDistrict] = useState<RegionOption | null>(null);
  const [selectedKecamatan, setSelectedKecamatan] = useState<RegionOption | null>(null);

  // Courier & Ongkir State
  const [courierOptions, setCourierOptions] = useState<CourierOption[]>(DEFAULT_COURIERS);
  const [selectedCourier, setSelectedCourier] = useState<CourierOption>(DEFAULT_COURIERS[0]);
  const [calculatingOngkir, setCalculatingOngkir] = useState(false);

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "cod_pickup">("qris");
  const [submitting, setSubmitting] = useState(false);

  // Load provinces on mount
  useEffect(() => {
    fetch("/api/shipping/regions?type=provinces")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProvinces(d);
      })
      .catch((err) => console.warn("Fetch provinces notice:", err));
  }, []);

  const handleProvinceChange = (provId: string) => {
    const prov = provinces.find((p) => p.province_id === provId || p.id === provId);
    setSelectedProvince(prov || null);
    setCityDistrict(null);
    setSelectedKecamatan(null);
    setCities([]);
    setSubdistricts([]);
    if (provId) {
      const provName = prov?.province || prov?.name || "";
      fetch(
        `/api/shipping/regions?type=cities&province_id=${provId}&province_name=${encodeURIComponent(
          provName
        )}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setCities(d);
        })
        .catch((err) => console.warn("Fetch cities notice:", err));
    }
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find((c) => c.city_id === cityId || c.id === cityId);
    setCityDistrict(city || null);
    setSelectedKecamatan(null);
    setSubdistricts([]);
    if (city && selectedProvince) {
      const provName = selectedProvince.province || selectedProvince.name || "";
      const cityName = city.city_name || city.name || "";
      fetch(
        `/api/shipping/regions?type=subdistricts&city_id=${cityId}&province_id=${
          selectedProvince.province_id || selectedProvince.id
        }&province_name=${encodeURIComponent(provName)}&city_name=${encodeURIComponent(cityName)}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setSubdistricts(d);
        })
        .catch((err) => console.warn("Fetch subdistricts notice:", err));
    }
  };

  const totalQuantity = checkoutItems.reduce((acc, curr) => acc + curr.quantity, 0);
  const itemTotal = checkoutItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const totalWeightGrams = Math.max(350, totalQuantity * 350);

  // Auto calculate ongkir
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
            district: selectedKecamatan?.name,
            weight: totalWeightGrams,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rates)) {
            setCourierOptions(data.rates);
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
  }, [selectedProvince, cityDistrict, selectedKecamatan, deliveryMethod, totalWeightGrams]);

  const shippingCost = deliveryMethod === "pickup" ? 0 : selectedCourier.cost;
  const grandTotal = itemTotal + shippingCost;

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (checkoutItems.length === 0) {
      alert("Keranjang belanja Anda kosong. Silakan pilih produk terlebih dahulu.");
      router.push("/");
      return;
    }

    setSubmitting(true);

    try {
      const cleanName = customerName.trim().slice(0, 150);
      const cleanWa = customerWa.replace(/[^\d+]/g, "").trim().slice(0, 20);

      if (!cleanName || !cleanWa || cleanWa.length < 8) {
        alert("Mohon lengkapi Nama dan Nomor WhatsApp yang valid (minimal 8 digit).");
        setSubmitting(false);
        return;
      }

      if (deliveryMethod === "courier" && (!customerAddress.trim() || !cityDistrict || !selectedKecamatan)) {
        alert("Mohon lengkapi Alamat Lengkap, Provinsi, Kota/Kabupaten, dan Kecamatan Pengiriman.");
        setSubmitting(false);
        return;
      }

      const fullAddressString =
        deliveryMethod === "pickup"
          ? "AMBIL DI TOKO (COD) - Dekat Jl. Mego Manis II No.10, Manisrejo, Kec. Taman, Kota Madiun, Jawa Timur 63138"
          : `${customerAddress.trim().slice(0, 1000)}, Kec. ${selectedKecamatan?.name || "-"}, ${
              cityDistrict?.type || ""
            } ${cityDistrict?.city_name || cityDistrict?.name || "-"}, ${
              selectedProvince?.province || selectedProvince?.name || "-"
            }`;

      const courierNameString =
        deliveryMethod === "pickup" ? "Ambil di Toko (COD Madiun)" : selectedCourier.name;

      const finalProductName =
        checkoutItems.length > 0
          ? checkoutItems.map((item) => item.productName).join(", ")
          : "Parfum AL Parfume";

      const finalSizeMl = checkoutItems[0].sizeMl;

      const itemsList = checkoutItems.map((item) => ({
        productName: item.productName,
        productSlug: item.productSlug,
        sizeMl: item.sizeMl,
        quantity: item.quantity,
        price: item.price,
      }));

      const cleanPayload = {
        product_name: finalProductName,
        size_ml: finalSizeMl,
        price: grandTotal,
        customer_name: cleanName,
        customer_wa: cleanWa,
        customer_address: fullAddressString,
        order_notes: orderNotes.trim().slice(0, 500) || null,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "qris" ? "pending_verification" : "cod_pickup",
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

      let finalOrderId: string | number | null = null;

      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanPayload }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => ({}));
        alert(errJson.error || "Gagal memproses pesanan di server. Silakan coba lagi.");
        setSubmitting(false);
        return;
      }

      const resJson = await createRes.json();
      if (resJson.data?.order_code || resJson.data?.id) {
        finalOrderId = resJson.data.order_code || resJson.data.id;
      } else {
        alert("Gagal mendapatkan ID pesanan. Silakan coba lagi.");
        setSubmitting(false);
        return;
      }

      // Decrement product stock
      try {
        for (const item of checkoutItems) {
          if (!item.productSlug) continue;
          const { data: prodData } = await supabase
            .from("products")
            .select("stock")
            .eq("slug", item.productSlug)
            .single();

          if (prodData && typeof prodData.stock === "number") {
            const nextStock = Math.max(0, prodData.stock - item.quantity);
            await supabase
              .from("products")
              .update({ stock: nextStock })
              .eq("slug", item.productSlug);
          }
        }
      } catch (stockErr) {
        console.error("Gagal mengurangi stok:", stockErr);
      }

      const orderIdToUse = finalOrderId || Date.now();

      // Save order receipt in localStorage for instant tracking
      const localOrderReceipt = {
        id: orderIdToUse,
        product_name: finalProductName,
        size_ml: finalSizeMl,
        quantity: totalQuantity,
        price: itemTotal,
        grandTotal,
        shippingCost,
        courierName: courierNameString,
        customerName: cleanName,
        customerWa: cleanWa,
        customerAddress: fullAddressString,
        deliveryMethod,
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

      if (isCartMode) {
        clearCart();
      }

      router.push(`/orders/${orderIdToUse}`);
    } catch (err) {
      console.error("Order submission error:", err);
      alert("Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDirectProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] font-sans">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Memuat detail pemesanan...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans pb-16">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-md border-b border-[var(--border)] py-4 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Toko</span>
          </Link>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Pembayaran Aman & Terpercaya</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-plus-jakarta">
            Checkout & Pembayaran
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Lengkapi data pengiriman di bawah ini untuk memproses pesanan Anda.
          </p>
        </div>

        {checkoutItems.length === 0 ? (
          <div className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto my-12">
            <ShoppingBag className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-60" />
            <h3 className="text-lg font-bold">Keranjang Belanja Kosong</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Anda belum memilih parfum apapun untuk dibeli.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Jelajahi Koleksi Parfum
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Customer & Shipping & Payment Inputs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Customer Information */}
              <section className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                  <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Informasi Pemesan</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Data ini digunakan untuk konfirmasi pesanan via WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold block flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold block flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Nomor WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerWa}
                      onChange={(e) => setCustomerWa(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold block flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Catatan Pesanan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Contoh: Titipkan di satpam / ucapan ulang tahun..."
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors"
                  />
                </div>
              </section>

              {/* Step 2: Delivery Method & Address */}
              <section className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
                  <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Metode Pengiriman</h2>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Pilih antara pengiriman kurir ekspedisi atau ambil di toko Madiun.
                    </p>
                  </div>
                </div>

                {/* Method selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("courier");
                      setPaymentMethod("qris");
                    }}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                      deliveryMethod === "courier"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-md"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <div>
                      <div className="font-bold text-xs">Kurir Ekspedisi</div>
                      <div className="text-[10px] opacity-80 mt-0.5">Tarif Akurat s/d Kecamatan</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMethod("pickup");
                      setPaymentMethod("cod_pickup");
                    }}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                      deliveryMethod === "pickup"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-md"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    <div>
                      <div className="font-bold text-xs">Ambil di Toko (COD)</div>
                      <div className="text-[10px] opacity-80 mt-0.5">Bebas Ongkir &bull; Bayar di Toko</div>
                    </div>
                  </button>
                </div>

                {deliveryMethod === "courier" ? (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold block">Provinsi *</label>
                        <select
                          required
                          value={selectedProvince?.province_id || selectedProvince?.id || ""}
                          onChange={(e) => handleProvinceChange(e.target.value)}
                          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors appearance-none cursor-pointer"
                        >
                          <option value="" disabled>
                            Pilih Provinsi...
                          </option>
                          {provinces.map((prov) => {
                            const id = prov.province_id || prov.id || "";
                            const name = prov.province || prov.name || "";
                            return (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold block">Kota / Kabupaten *</label>
                        <select
                          required
                          value={cityDistrict?.city_id || cityDistrict?.id || ""}
                          onChange={(e) => handleCityChange(e.target.value)}
                          disabled={!selectedProvince || cities.length === 0}
                          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>
                            Pilih Kota/Kab...
                          </option>
                          {cities.map((c) => {
                            const id = c.city_id || c.id || "";
                            const name =
                              c.name || (c.type ? `${c.type} ${c.city_name}` : c.city_name) || "";
                            return (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold block">Kecamatan *</label>
                        <select
                          required
                          value={selectedKecamatan?.id || ""}
                          onChange={(e) => {
                            const dist = subdistricts.find((d) => d.id === e.target.value);
                            setSelectedKecamatan(dist || null);
                          }}
                          disabled={!cityDistrict || subdistricts.length === 0}
                          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>
                            Pilih Kecamatan...
                          </option>
                          {subdistricts.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold block flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Alamat Jalan & Patokan *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Nama Jalan, Nomor Rumah, RT/RW, Patokan..."
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] transition-colors resize-none"
                      />
                    </div>

                    {/* Rates Options */}
                    <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold">
                          Opsi Ekspedisi ({totalQuantity} item &bull;{" "}
                          {totalWeightGrams >= 1000
                            ? `${(totalWeightGrams / 1000).toFixed(1)} kg`
                            : `${totalWeightGrams} gram`}
                          )
                        </label>
                        {calculatingOngkir && (
                          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Memeriksa ongkir...
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {courierOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCourier(c)}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              selectedCourier.id === c.id
                                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] font-bold shadow-sm"
                                : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--text-muted)]"
                            }`}
                          >
                            <div>
                              <div className="text-xs">{c.name}</div>
                              <div className="text-[10px] opacity-75">{c.est}</div>
                            </div>
                            <div className="text-xs font-bold">{formatRupiah(c.cost)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[var(--background)] border border-[var(--border)] rounded-2xl space-y-1.5">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-emerald-500" /> Pengambilan Toko Madiun (Bebas Ongkir):
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Dekat Jl. Mego Manis II No.10, Manisrejo, Kec. Taman, Kota Madiun, Jawa Timur 63138.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] italic">
                      *Navigasi Google Maps & petunjuk lokasi akan muncul di rincian pesanan.
                    </p>
                  </div>
                )}
              </section>

              {/* Step 3: Payment Method */}
              <section className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div>
                      <h2 className="text-base font-bold">Metode Pembayaran</h2>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Pilih metode pembayaran yang Anda inginkan.
                      </p>
                    </div>
                  </div>
                  {deliveryMethod === "courier" && (
                    <span className="text-[10px] bg-[var(--foreground)] text-[var(--background)] font-bold px-2.5 py-1 rounded-full">
                      Kurir: Hanya QRIS
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("qris")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                      paymentMethod === "qris"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-md"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <div>
                      <div className="font-bold text-xs">QRIS (Transfer QR)</div>
                      <div className="text-[10px] opacity-80 mt-0.5">BCA / Mandiri / GoPay / ShopeePay</div>
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
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                      deliveryMethod === "courier"
                        ? "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
                        : paymentMethod === "cod_pickup"
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-md cursor-pointer"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--text-muted)] cursor-pointer"
                    }`}
                  >
                    <Store className="w-5 h-5" />
                    <div>
                      <div className="font-bold text-xs">Bayar di Tempat (COD Toko)</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {deliveryMethod === "courier"
                          ? "Khusus Ambil di Toko"
                          : "Bayar Tunai saat Ambil di Toko"}
                      </div>
                    </div>
                  </button>
                </div>

                {paymentMethod === "qris" && (
                  <div className="p-4 bg-[var(--background)] border border-[var(--border)] rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Pembayaran via QRIS All Payment
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Setelah menekan <strong>Proses Pesanan Sekarang</strong>, Anda akan diarahkan ke halaman invoice untuk memindai QRIS dan mengunggah bukti pembayaran.
                    </p>
                  </div>
                )}

                {paymentMethod === "cod_pickup" && (
                  <div className="p-4 bg-[var(--foreground)] text-[var(--background)] rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <MapPin className="w-4 h-4" />
                      Pengambilan Toko & COD Tunai
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed font-light">
                      Lokasi toko Madiun & <strong>Google Maps Petunjuk Arah</strong> akan langsung ditampilkan setelah pesanan diproses.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT COLUMN: Order Summary Card */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
              <div className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-md">
                <h2 className="text-lg font-bold border-b border-[var(--border)] pb-4 font-plus-jakarta flex items-center justify-between">
                  <span>Ringkasan Pesanan</span>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    {totalQuantity} Item
                  </span>
                </h2>

                {/* Items list */}
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {checkoutItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 bg-[var(--background)] p-3.5 rounded-2xl border border-[var(--border)]"
                    >
                      <div className="relative w-16 h-16 bg-[var(--background-secondary)] rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border)]">
                        {sanitizeImageUrl(item.imageUrl) ? (
                          <Image
                            src={sanitizeImageUrl(item.imageUrl)!}
                            alt={item.productName}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">
                            AL
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm uppercase truncate">
                          {item.productName}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          Varian {item.sizeMl} ml &bull; {item.quantity}x
                        </p>
                        <p className="text-xs font-bold mt-1">{formatRupiah(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <div className="border-t border-[var(--border)] pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Subtotal Produk</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {formatRupiah(itemTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>
                      Ongkos Kirim ({deliveryMethod === "pickup" ? "Ambil Toko" : selectedCourier.name})
                    </span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {shippingCost === 0 ? "GRATIS" : formatRupiah(shippingCost)}
                    </span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-[var(--foreground)] border-t border-dashed border-[var(--border)] pt-3 mt-3">
                    <span>Total Pembayaran</span>
                    <span>{formatRupiah(grandTotal)}</span>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--foreground)] hover:opacity-95 text-[var(--background)] py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer font-sans disabled:opacity-50"
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

                <div className="text-center">
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Dengan memproses pesanan, Anda menyetujui syarat & ketentuan transaksi AL PARFUME.
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
