"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { supabase, Testimonial } from "@/lib/supabase";
import { sanitizeImageUrl } from "@/lib/imageHelper";
import {
  Star,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Search,
  Upload,
  Loader2,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  User,
} from "lucide-react";

interface ProductOption {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  category_id?: string | null;
  categories?: { name: string } | null;
}

export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState("");
  const [rating, setRating] = useState(5);
  const [productId, setProductId] = useState<string>("");
  const [productNameOverride, setProductNameOverride] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [tag, setTag] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);

  // Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const parseError = (err: unknown): string => {
    if (!err) return "Terjadi kesalahan tidak diketahui.";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (typeof err === "object") {
      const o = err as Record<string, unknown>;
      if (typeof o.message === "string") return o.message;
      if (typeof o.error === "string") return o.error;
      try {
        return JSON.stringify(err);
      } catch {
        return "Terjadi kesalahan sistem.";
      }
    }
    return String(err);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch products for dropdown with category name
      const { data: prodData } = await supabase
        .from("products")
        .select("id, name, slug, image_url, category_id, categories(name)")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (prodData) {
        setProducts(prodData as unknown as ProductOption[]);
      }

      // 2. Fetch testimonials via Admin API
      const res = await fetch("/api/admin/testimonials");
      const json = await res.json().catch(() => ({}));
      if (json.success && Array.isArray(json.data)) {
        setTestimonials(json.data);
      }
    } catch (err) {
      console.error("Error fetching testimonials data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setCustomerName("");
    setCustomerAvatarUrl("");
    setRating(5);
    setProductId(products.length > 0 ? products[0].id : "");
    setProductNameOverride("");
    setReviewText("");
    setTag("");
    setImageUrl("");
    setIsVerifiedBuyer(true);
    setIsActive(true);
    setSortOrder(testimonials.length + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Testimonial) => {
    setEditingItem(item);
    setCustomerName(item.customer_name);
    setCustomerAvatarUrl(item.customer_avatar_url || "");
    setRating(item.rating || 5);
    setProductId(item.product_id || "");
    setProductNameOverride(item.product_name_override || "");
    setReviewText(item.review_text);
    setTag(item.tag || "");
    setImageUrl(item.image_url || "");
    setIsVerifiedBuyer(item.is_verified_buyer ?? true);
    setIsActive(item.is_active ?? true);
    setSortOrder(item.sort_order || 1);
    setIsModalOpen(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const fileName = `avatar-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `testimonials/avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      if (data?.publicUrl) {
        setCustomerAvatarUrl(data.publicUrl);
      }
    } catch (err) {
      console.error("Gagal mengupload foto profil:", err);
      alert(`Gagal mengunggah foto profil: ${parseError(err)}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileName = `review-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `testimonials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      if (data?.publicUrl) {
        setImageUrl(data.publicUrl);
      }
    } catch (err: unknown) {
      console.error("Gagal mengupload foto:", err);
      alert(`Gagal mengunggah gambar: ${parseError(err)}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !reviewText.trim()) {
      alert("Nama pelanggan dan ulasan wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;

      // Refresh session if possible
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          token = refreshed.session.access_token;
        }
      } catch {
        // use cached token
      }

      if (!token) {
        alert("Sesi login admin berakhir. Silakan login kembali.");
        return;
      }

      const payload = {
        customer_name: customerName.trim(),
        customer_avatar_url: customerAvatarUrl.trim() || null,
        rating: Number(rating),
        product_id: productId || null,
        product_name_override: productNameOverride.trim() || null,
        review_text: reviewText.trim(),
        tag: tag.trim() || null,
        image_url: imageUrl.trim() || null,
        is_verified_buyer: isVerifiedBuyer,
        is_active: isActive,
        sort_order: Number(sortOrder),
      };

      const isEditing = Boolean(editingItem && editingItem.id);
      const res = await fetch("/api/admin/testimonials", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(isEditing ? { id: editingItem!.id, ...payload } : payload),
      });

      let errorText = "Gagal menyimpan ulasan.";
      try {
        const json = await res.json();
        if (json?.error) errorText = json.error;
        else if (json?.message) errorText = json.message;
      } catch {
        errorText = `Server error (${res.status}): Tidak dapat memproses respons.`;
      }

      if (!res.ok) {
        throw new Error(errorText);
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      console.error("Error saving testimonial:", err);
      alert(`Gagal menyimpan ulasan: ${parseError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: Testimonial) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) token = refreshed.session.access_token;
      } catch {
        // use cached
      }

      if (!token) {
        alert("Sesi login admin berakhir.");
        return;
      }

      const newStatus = !item.is_active;
      const res = await fetch("/api/admin/testimonials", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: item.id, is_active: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Gagal memperbarui status ulasan.");
      }

      await fetchData();
    } catch (err) {
      console.error("Gagal mengubah status aktif:", err);
      alert(`Gagal memperbarui status: ${parseError(err)}`);
    }
  };

  const handleDelete = async (item: Testimonial) => {
    const confirmDelete = window.confirm(`Hapus ulasan dari ${item.customer_name}?`);
    if (!confirmDelete) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) token = refreshed.session.access_token;
      } catch {
        // use cached
      }

      if (!token) {
        alert("Sesi login admin berakhir.");
        return;
      }

      const res = await fetch(`/api/admin/testimonials?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Gagal menghapus ulasan.");
      }

      await fetchData();
    } catch (err) {
      console.error("Gagal menghapus ulasan:", err);
      alert(`Gagal menghapus: ${parseError(err)}`);
    }
  };

  // Filter list
  const filtered = testimonials.filter((t) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = t.customer_name.toLowerCase().includes(q);
    const textMatch = t.review_text.toLowerCase().includes(q);
    const prodMatch = (t.product_name_override || t.products?.name || "").toLowerCase().includes(q);
    return nameMatch || textMatch || prodMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
            Kelola Ulasan Pelanggan
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Ulasan yang tampil di homepage tepat di bawah bagian Best Seller.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Ulasan
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan, produk, atau kata kunci ulasan..."
          className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-4 py-3 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-black transition-colors shadow-xs"
        />
      </div>

      {/* Testimonials Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
            <p className="text-xs font-medium">Memuat daftar ulasan...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 space-y-2">
            <p className="text-sm font-bold text-neutral-800">Tidak ada ulasan ditemukan</p>
            <p className="text-xs text-neutral-400">Silakan tambahkan ulasan baru atau reset pencarian.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">Urutan</th>
                  <th className="py-3.5 px-4">Pelanggan</th>
                  <th className="py-3.5 px-4">Rating</th>
                  <th className="py-3.5 px-4">Varian Terkait</th>
                  <th className="py-3.5 px-4 max-w-xs">Isi Ulasan</th>
                  <th className="py-3.5 px-4">Foto Real</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((item, index) => {
                  const displayPhoto = sanitizeImageUrl(item.image_url);
                  const displayAvatar = sanitizeImageUrl(item.customer_avatar_url);
                  const productName = item.product_name_override || item.products?.name || "-";

                  return (
                    <tr key={item.id || index} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-neutral-500">
                        {item.sort_order ?? index + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {displayAvatar ? (
                            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-neutral-200 shrink-0">
                              <Image
                                src={displayAvatar}
                                alt="Foto profil"
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-700 text-xs font-bold shrink-0">
                              {item.customer_name?.charAt(0) || "U"}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-neutral-900">{item.customer_name}</div>
                            {item.is_verified_buyer !== false && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[...Array(item.rating || 5)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-neutral-800">{productName}</span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-neutral-600 text-xs line-clamp-2 leading-relaxed">
                        &ldquo;{item.review_text}&rdquo;
                      </td>
                      <td className="py-3.5 px-4">
                        {displayPhoto ? (
                          <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-neutral-200">
                            <Image
                              src={displayPhoto}
                              alt="Thumbnail foto pelanggan"
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs">Tanpa foto</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(item)}
                          title={item.is_active ? "Nonaktifkan ulasan" : "Aktifkan ulasan"}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200"
                          }`}
                        >
                          {item.is_active ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-neutral-400" />
                              Sembunyi
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
                            title="Edit Ulasan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Ulasan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                {editingItem ? "Edit Ulasan Pelanggan" : "Tambah Ulasan Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
              {/* Customer Name */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Nama Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Dinda Pratiwi"
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:border-black focus:outline-none"
                />
              </div>

              {/* Foto Profil Pelanggan (Avatar) */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Foto Profil Pelanggan / Avatar (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  {customerAvatarUrl ? (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-neutral-200 shrink-0">
                      <Image
                        src={customerAvatarUrl}
                        alt="Preview Avatar"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomerAvatarUrl("")}
                        className="absolute top-0 right-0 bg-black/70 text-white rounded-full p-0.5 hover:bg-black cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-grow space-y-1.5">
                    <input
                      type="file"
                      ref={avatarInputRef}
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-image-upload"
                    />
                    <label
                      htmlFor="avatar-image-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-neutral-700 cursor-pointer text-xs font-semibold"
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Unggah Foto Profil
                        </>
                      )}
                    </label>
                    <input
                      type="text"
                      value={customerAvatarUrl}
                      onChange={(e) => setCustomerAvatarUrl(e.target.value)}
                      placeholder="Atau tempel URL foto profil..."
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Rating Bintang */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Rating Bintang</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:border-black focus:outline-none"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5 Bintang - Sangat Puas)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 Bintang - Puas)</option>
                  <option value={3}>⭐⭐⭐ (3 Bintang - Cukup)</option>
                  <option value={2}>⭐⭐ (2 Bintang - Kurang)</option>
                  <option value={1}>⭐ (1 Bintang - Tidak Puas)</option>
                </select>
              </div>

              {/* Produk Terkait */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Produk Terkait (Katalog Al Parfume)
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:border-black focus:outline-none"
                >
                  <option value="">-- Pilih Produk Terkait --</option>
                  {/* Grouped by categories */}
                  {Array.from(new Set(products.map((p) => p.categories?.name || "Koleksi Lainnya"))).map((catName) => (
                    <optgroup key={catName} label={`Kategori: ${catName}`}>
                      {products
                        .filter((p) => (p.categories?.name || "Koleksi Lainnya") === catName)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Custom Variant Label */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Label Varian Custom (Opsional)
                </label>
                <input
                  type="text"
                  value={productNameOverride}
                  onChange={(e) => setProductNameOverride(e.target.value)}
                  placeholder="Contoh: Elysian Vanilla 50ml EDP"
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:border-black focus:outline-none"
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Isi Ulasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tulis ulasan aroma, daya tahan, atau kepuasan pembeli..."
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:border-black focus:outline-none leading-relaxed"
                />
              </div>

              {/* Foto Pelanggan (Upload & URL) */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Foto Real / Unboxing Pelanggan (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-neutral-200 shrink-0">
                      <Image
                        src={imageUrl}
                        alt="Preview foto ulasan"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-black cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 shrink-0 text-xs">
                      Foto
                    </div>
                  )}

                  <div className="flex-grow space-y-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="review-image-upload"
                    />
                    <label
                      htmlFor="review-image-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-neutral-700 cursor-pointer text-xs font-semibold"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Unggah Foto Real
                        </>
                      )}
                    </label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Atau tempel URL gambar langsung..."
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles: Verified Buyer, Active, Sort Order */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  <input
                    type="checkbox"
                    checked={isVerifiedBuyer}
                    onChange={(e) => setIsVerifiedBuyer(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-black focus:ring-0"
                  />
                  <span className="font-semibold text-neutral-800 text-xs">Verified Buyer</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-black focus:ring-0"
                  />
                  <span className="font-semibold text-neutral-800 text-xs">Tampilkan di Web</span>
                </label>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Urutan Tampil (Makin kecil tampil makin awal)
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className="w-24 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs focus:border-black focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-neutral-600 hover:text-black rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItem ? "Simpan Perubahan" : "Tambahkan Ulasan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
