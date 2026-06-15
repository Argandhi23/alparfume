"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase, ProductWithVariants, OrderIntent } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { 
  Plus, Edit2, Trash2, LogOut, Loader2, 
  ToggleLeft, ToggleRight, X, FileText, CheckCircle2, ArrowLeft 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function AdminDashboard() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "intents">("products");
  
  // Data States
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [intents, setIntents] = useState<OrderIntent[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"add" | "edit">("add");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTopNotes, setFormTopNotes] = useState("");
  const [formMiddleNotes, setFormMiddleNotes] = useState("");
  const [formBottomNotes, setFormBottomNotes] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formVariants, setFormVariants] = useState<{ size_ml: number; price: number }[]>([
    { size_ml: 35, price: 45000 }
  ]);
  const [formImages, setFormImages] = useState<(string | null)[]>([null, null, null]);
  const [slotStatuses, setSlotStatuses] = useState<("idle" | "uploading" | "error")[]>(["idle", "idle", "idle"]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check Session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/admin/login");
      } else {
        setLoadingSession(false);
        fetchData();
      }
    };
    checkSession();
  }, [router]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      const { data: intentsData, error: intentsError } = await supabase
        .from("order_intents")
        .select("*")
        .order("created_at", { ascending: false });

      if (intentsError) throw intentsError;

      setProducts(productsData || []);
      setIntents(intentsData || []);
    } catch (err) {
      console.error("Gagal mengambil data dari database:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const onNameChange = (val: string) => {
    setFormName(val);
    if (modalType === "add") {
      setFormSlug(generateSlug(val));
    }
  };

  const openAddModal = () => {
    setModalType("add");
    setSelectedProductId(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormTopNotes("");
    setFormMiddleNotes("");
    setFormBottomNotes("");
    setFormIsActive(true);
    setFormVariants([{ size_ml: 35, price: 45000 }]);
    setFormImages([null, null, null]);
    setSlotStatuses(["idle", "idle", "idle"]);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (product: ProductWithVariants) => {
    setModalType("edit");
    setSelectedProductId(product.id);
    setFormName(product.name);
    setFormSlug(product.slug);
    setFormDescription(product.description);
    
    let top = "";
    let middle = "";
    let bottom = "";
    if (product.notes) {
      try {
        const parsed = JSON.parse(product.notes);
        top = parsed.top || "";
        middle = parsed.middle || "";
        bottom = parsed.bottom || "";
      } catch {
        top = product.notes;
      }
    }
    setFormTopNotes(top);
    setFormMiddleNotes(middle);
    setFormBottomNotes(bottom);
    setFormIsActive(product.is_active);
    
    if (product.product_variants && product.product_variants.length > 0) {
      setFormVariants(product.product_variants.map(v => ({ size_ml: v.size_ml, price: v.price })));
    } else {
      setFormVariants([{ size_ml: 35, price: 45000 }]);
    }

    const initialImages: (string | null)[] = [null, null, null];
    if (product.image_url) {
      if (product.image_url.startsWith("[")) {
        try {
          const parsed = JSON.parse(product.image_url);
          if (Array.isArray(parsed)) {
            for (let i = 0; i < 3; i++) {
              if (parsed[i]) {
                initialImages[i] = parsed[i];
              }
            }
          }
        } catch {
          initialImages[0] = product.image_url;
        }
      } else {
        initialImages[0] = product.image_url;
      }
    }
    setFormImages(initialImages);
    setSlotStatuses(["idle", "idle", "idle"]);
    setFormError("");
    setIsModalOpen(true);
  };

  const addVariantRow = () => {
    setFormVariants([...formVariants, { size_ml: 0, price: 0 }]);
  };

  const removeVariantRow = (index: number) => {
    const updated = formVariants.filter((_, i) => i !== index);
    setFormVariants(updated.length > 0 ? updated : [{ size_ml: 0, price: 0 }]);
  };

  const updateVariantRow = (index: number, field: "size_ml" | "price", value: number) => {
    const updated = [...formVariants];
    updated[index][field] = value;
    setFormVariants(updated);
  };

  const getStoragePathFromUrl = (url: string) => {
    const marker = "/product-images/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return url.substring(idx + marker.length);
    }
    return null;
  };

  const handleSlotUpload = async (index: number, file: File) => {
    const updatedStatuses = [...slotStatuses];
    updatedStatuses[index] = "uploading";
    setSlotStatuses(updatedStatuses);

    try {
      const fileExt = file.name.split(".").pop();
      const slug = formSlug || "product";
      const fileName = `${slug}-${Date.now()}-${index}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Delete old image in this slot if exists
      const oldUrl = formImages[index];
      if (oldUrl) {
        const oldPath = getStoragePathFromUrl(oldUrl);
        if (oldPath) {
          await supabase.storage.from("product-images").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const updatedImages = [...formImages];
      updatedImages[index] = publicUrl;
      setFormImages(updatedImages);

      const nextStatuses = [...slotStatuses];
      nextStatuses[index] = "idle";
      setSlotStatuses(nextStatuses);

      // Sync to database immediately if editing
      if (modalType === "edit" && selectedProductId) {
        const newImageUrl = JSON.stringify(updatedImages.filter(Boolean));
        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: newImageUrl })
          .eq("id", selectedProductId);

        if (updateError) throw updateError;
        fetchData();
      }
    } catch (err) {
      console.error("Upload error:", err);
      const nextStatuses = [...slotStatuses];
      nextStatuses[index] = "error";
      setSlotStatuses(nextStatuses);
    }
  };

  const handleSlotDelete = async (index: number) => {
    const oldUrl = formImages[index];
    if (!oldUrl) return;

    try {
      const path = getStoragePathFromUrl(oldUrl);
      if (path) {
        await supabase.storage.from("product-images").remove([path]);
      }
    } catch (err) {
      console.error("Storage delete error:", err);
    }

    const updatedImages = [...formImages];
    updatedImages[index] = null;
    setFormImages(updatedImages);

    const updatedStatuses = [...slotStatuses];
    updatedStatuses[index] = "idle";
    setSlotStatuses(updatedStatuses);

    // Sync to database immediately if editing
    if (modalType === "edit" && selectedProductId) {
      try {
        const newImageUrl = JSON.stringify(updatedImages.filter(Boolean));
        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: newImageUrl })
          .eq("id", selectedProductId);

        if (updateError) throw updateError;
        fetchData();
      } catch (err) {
        console.error("Database update error:", err);
      }
    }
  };

  const handleClearSlotStatus = (index: number) => {
    const updatedStatuses = [...slotStatuses];
    updatedStatuses[index] = "idle";
    setSlotStatuses(updatedStatuses);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      if (!formName.trim() || !formSlug.trim()) {
        throw new Error("Nama dan Slug harus diisi.");
      }

      const invalidVariant = formVariants.find(v => v.size_ml <= 0 || v.price <= 0);
      if (invalidVariant) {
        throw new Error("Harap isi ukuran dan harga varian dengan benar (lebih besar dari 0).");
      }

      // Filter out null images before saving to exclude empty slots
      const finalImageUrl = JSON.stringify(formImages.filter(Boolean));

      const notesObject = {
        top: formTopNotes.trim(),
        middle: formMiddleNotes.trim(),
        bottom: formBottomNotes.trim()
      };
      const notesString = JSON.stringify(notesObject);

      let productId = selectedProductId;

      if (modalType === "add") {
        const { data: newProd, error: prodError } = await supabase
          .from("products")
          .insert([
            {
              name: formName.trim(),
              slug: formSlug.trim(),
              description: formDescription.trim(),
              notes: notesString,
              image_url: finalImageUrl,
              is_active: formIsActive
            }
          ])
          .select()
          .single();

        if (prodError) throw prodError;
        productId = newProd.id;

      } else {
        const { error: prodError } = await supabase
          .from("products")
          .update({
            name: formName.trim(),
            slug: formSlug.trim(),
            description: formDescription.trim(),
            notes: notesString,
            image_url: finalImageUrl,
            is_active: formIsActive
          })
          .eq("id", productId);

        if (prodError) throw prodError;

        const { error: delVarError } = await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", productId);

        if (delVarError) throw delVarError;
      }

      const variantsToInsert = formVariants.map(v => ({
        product_id: productId,
        size_ml: v.size_ml,
        price: v.price
      }));

      const { error: varError } = await supabase
        .from("product_variants")
        .insert(variantsToInsert);

      if (varError) throw varError;

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan produk.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const { error: delVarError } = await supabase
        .from("product_variants")
        .delete()
        .eq("product_id", deleteTargetId);

      if (delVarError) throw delVarError;

      const { error: delError } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteTargetId);

      if (delError) throw delError;

      setDeleteTargetId(null);
      fetchData();
    } catch (err) {
      console.error("Gagal menghapus produk:", err);
    } finally {
      setDeleting(false);
    }
  };

  const toggleProductStatus = async (product: ProductWithVariants) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);

      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error("Gagal mengubah status aktif produk:", err);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-400" />
          <p className="text-xs uppercase tracking-widest text-neutral-400 font-sans">Memeriksa Sesi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans pb-24">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-plus-jakarta text-lg font-semibold text-neutral-900">Al Parfume Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 border border-neutral-200 px-5 py-2 text-xs uppercase tracking-wider font-medium rounded-full transition-colors duration-200 text-neutral-700 bg-white hover:bg-neutral-50 font-sans shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Website
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-wider font-medium rounded-full transition-colors duration-200 text-neutral-500 hover:text-black hover:bg-neutral-50 font-sans"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 mt-12">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-100 mb-8">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs uppercase tracking-widest border-b-2 transition-all font-medium font-sans ${
              activeTab === "products"
                ? "border-black text-black"
                : "border-transparent text-neutral-400 hover:text-black"
            }`}
          >
            <FileText className="w-4 h-4" />
            Kelola Produk ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("intents")}
            className={`flex items-center gap-2 px-6 py-3.5 text-xs uppercase tracking-widest border-b-2 transition-all font-medium font-sans ${
              activeTab === "intents"
                ? "border-black text-black"
                : "border-transparent text-neutral-400 hover:text-black"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Riwayat Pesanan ({intents.length})
          </button>
        </div>

        {/* Tab content 1: Manage Products */}
        {activeTab === "products" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Katalog Produk</h2>
                <p className="text-xs text-neutral-500 font-sans">Tambah, ubah, atau hapus koleksi parfum Anda</p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-black text-white hover:bg-neutral-800 px-6 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold flex items-center gap-2 transition-colors duration-200 font-sans"
              >
                <Plus className="w-4 h-4" />
                Tambah Produk
              </button>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-neutral-100 rounded-2xl bg-white">
                <p className="text-xs tracking-widest text-neutral-400 uppercase font-sans">Belum ada produk</p>
              </div>
            ) : (
              <div className="border border-neutral-100 bg-white rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-400 tracking-wider uppercase font-semibold text-[10px] font-sans">
                      <th className="py-4 px-6 w-20">Foto</th>
                      <th className="py-4 px-6">Nama / Slug</th>
                      <th className="py-4 px-6">Ukuran & Harga Varian</th>
                      <th className="py-4 px-6 w-32 text-center">Status Aktif</th>
                      <th className="py-4 px-6 w-36 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod) => (
                      <tr key={prod.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="relative w-12 h-12 bg-neutral-50 border border-neutral-100 rounded-xl overflow-hidden">
                            {(() => {
                              let displayImage = "";
                              if (prod.image_url) {
                                if (prod.image_url.startsWith("[")) {
                                  try {
                                    const parsed = JSON.parse(prod.image_url);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                      displayImage = parsed[0];
                                    }
                                  } catch {
                                    displayImage = prod.image_url;
                                  }
                                } else {
                                  displayImage = prod.image_url;
                                }
                              }
                              return displayImage ? (
                                <Image
                                  src={displayImage}
                                  alt={prod.name}
                                  fill
                                  className="object-cover rounded-xl"
                                />
                              ) : null;
                            })() || (
                              <div className="absolute inset-0 flex items-center justify-center text-[8px] uppercase tracking-widest text-neutral-300 font-sans">
                                Null
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-sm text-neutral-900 uppercase font-sans">{prod.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{prod.slug}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5 font-sans">
                            {prod.product_variants && prod.product_variants.length > 0 ? (
                              prod.product_variants.map((v) => (
                                <span key={v.id} className="px-2 py-1 bg-neutral-50 border border-neutral-100 rounded-full text-[10px] tracking-wide text-neutral-600">
                                  {v.size_ml}ml: {formatRupiah(v.price)}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400 italic">Tidak ada varian</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => toggleProductStatus(prod)}
                            className="inline-flex items-center justify-center transition-opacity hover:opacity-85 focus:outline-none"
                            title={prod.is_active ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {prod.is_active ? (
                              <span className="bg-neutral-900 text-white text-[10px] rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider font-sans">
                                Aktif
                              </span>
                            ) : (
                              <span className="bg-neutral-100 text-neutral-500 text-[10px] rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider font-sans">
                                Buram
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => openEditModal(prod)}
                              className="p-2 border border-neutral-200 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-50 bg-white transition-all shadow-sm"
                              title="Edit Produk"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTargetId(prod.id)}
                              className="p-2 border border-neutral-200 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-50 bg-white transition-all shadow-sm"
                              title="Hapus Produk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab content 2: Order Intents History */}
        {activeTab === "intents" && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Riwayat Klik WhatsApp</h2>
              <p className="text-xs text-neutral-500 font-sans">Melihat daftar produk yang diminati pelanggan sebelum menuju WhatsApp</p>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
              </div>
            ) : intents.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-neutral-100 rounded-2xl bg-white">
                <p className="text-xs tracking-widest text-neutral-400 uppercase font-sans">Belum ada aktivitas pesanan</p>
              </div>
            ) : (
              <div className="border border-neutral-100 bg-white rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-400 tracking-wider uppercase font-semibold text-[10px] font-sans">
                      <th className="py-4 px-6">Tanggal & Waktu</th>
                      <th className="py-4 px-6">Pelanggan</th>
                      <th className="py-4 px-6">WhatsApp</th>
                      <th className="py-4 px-6">Alamat COD</th>
                      <th className="py-4 px-6">Detail Pesanan</th>
                      <th className="py-4 px-6">Catatan</th>
                      <th className="py-4 px-6">Total Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intents.map((int) => {
                      let items = [];
                      if (int.items_json) {
                        try {
                          items = JSON.parse(int.items_json);
                        } catch (e) {
                          console.error("Failed to parse items_json", e);
                        }
                      }
                      
                      return (
                        <tr key={int.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 text-xs">
                          <td className="py-4 px-6 font-mono text-[10px] text-neutral-500 whitespace-nowrap">
                            {new Date(int.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short"
                            })}
                          </td>
                          <td className="py-4 px-6 font-semibold text-neutral-900 font-sans">
                            {int.customer_name || "-"}
                          </td>
                          <td className="py-4 px-6 text-neutral-600 font-sans">
                            {int.customer_wa ? (
                              <a
                                href={`https://wa.me/${int.customer_wa}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-black"
                              >
                                {int.customer_wa}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-4 px-6 text-neutral-600 font-sans max-w-xs truncate" title={int.customer_address || ""}>
                            {int.customer_address || "-"}
                          </td>
                          <td className="py-4 px-6 text-neutral-700 font-sans">
                            {items.length > 0 ? (
                              <ul className="list-disc pl-4 space-y-0.5">
                                {items.map((item: { productName: string; sizeMl: number; quantity: number }, idx: number) => (
                                  <li key={idx}>
                                    {item.productName} ({item.sizeMl}ml) × {item.quantity}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span>{int.product_name} ({int.size_ml}ml)</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-neutral-500 italic max-w-xs truncate font-sans" title={int.order_notes || ""}>
                            {int.order_notes || "-"}
                          </td>
                          <td className="py-4 px-6 text-neutral-900 font-semibold font-sans whitespace-nowrap">
                            {formatRupiah(int.price)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm border border-neutral-100 bg-white rounded-2xl p-6 space-y-6 shadow-lg">
            <h3 className="font-plus-jakarta text-lg font-semibold uppercase tracking-wider text-neutral-900">Hapus Produk?</h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-light font-sans">
              Tindakan ini permanen. Semua data produk beserta varian harga di dalamnya akan dihapus selamanya dari sistem.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteTargetId(null)}
                disabled={deleting}
                className="flex-1 border border-neutral-200 hover:border-neutral-300 text-neutral-700 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors duration-200 bg-white font-sans"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="flex-1 bg-black hover:bg-neutral-800 text-white py-2.5 rounded-full text-xs uppercase tracking-widest font-bold transition-colors duration-200 flex items-center justify-center gap-2 font-sans"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL (ADD & EDIT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl border border-neutral-100 bg-white rounded-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto relative my-8 shadow-xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-black rounded-full p-1 hover:bg-neutral-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-plus-jakarta text-xl font-semibold uppercase tracking-widest text-neutral-900">
                {modalType === "add" ? "Tambah Produk Baru" : "Edit Detail Produk"}
              </h3>
              <p className="text-xs tracking-wider text-neutral-400 uppercase font-sans font-semibold">Informasi Utama & Spesifikasi</p>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              {formError && (
                <div className="border border-red-100 bg-red-50 p-3 rounded-lg text-xs text-red-700 font-semibold text-center font-sans">
                  {formError}
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Side: Text Details */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs tracking-wider text-neutral-400 uppercase font-semibold font-sans">Nama Produk</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => onNameChange(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 transition-colors font-sans"
                      placeholder="Contoh: SERENITY"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs tracking-wider text-neutral-400 uppercase font-semibold font-sans">Slug (Auto-generated)</label>
                    <input
                      type="text"
                      required
                      value={formSlug}
                      onChange={(e) => setFormSlug(generateSlug(e.target.value))}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-neutral-700 focus:outline-none focus:border-neutral-900 focus:ring-0 transition-colors font-mono"
                      placeholder="contoh-serenity"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs tracking-wider text-neutral-400 uppercase font-semibold font-sans">Deskripsi Singkat</label>
                    <textarea
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 transition-colors resize-none leading-relaxed font-sans"
                      placeholder="Tulis karakteristik wangi parfum..."
                    />
                  </div>

                  {/* Status Toggle */}
                  <div className="flex items-center justify-between py-2.5 border-t border-neutral-100">
                    <div className="space-y-0.5">
                      <span className="text-xs tracking-wider text-neutral-400 uppercase font-semibold font-sans">Status Aktif</span>
                      <span className="text-[10px] text-neutral-400 font-sans">Produk yang tidak aktif tidak muncul di catalog</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsActive(!formIsActive)}
                      className="text-brandBlack focus:outline-none"
                    >
                      {formIsActive ? (
                        <ToggleRight className="w-10 h-10 text-black" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-neutral-200" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Side: Notes & Image Upload */}
                <div className="space-y-4">
                  {/* Notes Breakdowns */}
                  <div className="space-y-3 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl">
                    <span className="text-xs tracking-wider text-neutral-400 block font-bold font-sans">Aroma Notes</span>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs tracking-wider text-neutral-400 block font-sans">Top Notes</label>
                      <input
                        type="text"
                        value={formTopNotes}
                        onChange={(e) => setFormTopNotes(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 font-sans"
                        placeholder="e.g. Lavender, Bergamot"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs tracking-wider text-neutral-400 block font-sans">Heart / Middle Notes</label>
                      <input
                        type="text"
                        value={formMiddleNotes}
                        onChange={(e) => setFormMiddleNotes(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 font-sans"
                        placeholder="e.g. Jasmine, Peony"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs tracking-wider text-neutral-400 block font-sans">Base Notes</label>
                      <input
                        type="text"
                        value={formBottomNotes}
                        onChange={(e) => setFormBottomNotes(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 font-sans"
                        placeholder="e.g. Musk, Sandalwood"
                      />
                    </div>
                  </div>

                  {/* Image Upload Area */}
                  <div className="space-y-2">
                    <span className="text-xs tracking-wider text-neutral-400 uppercase font-sans font-semibold block">
                      Foto Produk (Maksimal 3)
                    </span>
                    <div className="grid grid-cols-3 gap-4">
                      {[0, 1, 2].map((index) => {
                        const url = formImages[index];
                        const status = slotStatuses[index];

                        return (
                          <div key={index} className="relative aspect-square w-full">
                            {status === "uploading" && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl">
                                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                <span className="text-[9px] text-neutral-400 mt-1 font-sans">Mengunggah...</span>
                              </div>
                            )}

                            {status === "error" && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/50 border-2 border-dashed border-red-200 rounded-xl p-2 text-center">
                                <X className="w-5 h-5 text-red-500 hover:text-red-700 cursor-pointer" onClick={() => handleClearSlotStatus(index)} />
                                <span className="text-[9px] text-red-500 mt-1 font-sans font-medium">Gagal upload</span>
                              </div>
                            )}

                            {status === "idle" && !url && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:bg-neutral-100 hover:border-neutral-300 transition-colors">
                                <Plus className="w-5 h-5 text-neutral-400" />
                                <span className="text-[9px] text-neutral-400 mt-1 font-sans">Tambah Foto</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleSlotUpload(index, e.target.files[0]);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            )}

                            {status === "idle" && url && (
                              <div className="group relative w-full h-full border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50 cursor-pointer">
                                <Image
                                  src={url}
                                  alt={`Product Image ${index + 1}`}
                                  fill
                                  className="object-cover rounded-xl transition-all group-hover:scale-105"
                                />
                                {/* Slight dark overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-xl" />
                                
                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSlotDelete(index);
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors z-10 shadow-sm"
                                >
                                  <span className="text-sm font-semibold leading-none">&times;</span>
                                </button>

                                {/* Click slot -> new upload */}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleSlotUpload(index, e.target.files[0]);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Variants Setup Section */}
              <div className="border-t border-neutral-100 pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs tracking-wider text-neutral-400 font-semibold block font-sans">Varian Ukuran & Harga</span>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="border border-neutral-200 hover:border-neutral-300 bg-white px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5 transition-colors font-sans text-brandBlack shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris Varian
                  </button>
                </div>

                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                  {formVariants.map((variant, index) => (
                    <div key={index} className="flex gap-4 items-center bg-neutral-50/50 border border-neutral-100 rounded-2xl p-3">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            required
                            min={1}
                            value={variant.size_ml || ""}
                            onChange={(e) => updateVariantRow(index, "size_ml", parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 font-sans"
                            placeholder="Ukuran (ml)"
                          />
                          <span className="text-xs text-neutral-500 uppercase font-semibold font-sans">ml</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500 font-semibold font-sans">Rp</span>
                          <input
                            type="number"
                            required
                            min={100}
                            value={variant.price || ""}
                            onChange={(e) => updateVariantRow(index, "price", parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-neutral-200 rounded-lg px-3 py-2 text-xs text-brandBlack focus:outline-none focus:border-neutral-900 focus:ring-0 font-sans"
                            placeholder="Harga (Rupiah)"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeVariantRow(index)}
                        className="p-2 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                        title="Hapus varian ini"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving || slotStatuses.includes("uploading")}
                  className="flex-1 border border-neutral-200 hover:border-neutral-300 text-neutral-700 py-3 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors bg-white font-sans"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || slotStatuses.includes("uploading")}
                  className="flex-1 bg-black hover:bg-neutral-800 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2 font-sans"
                >
                  {saving || slotStatuses.includes("uploading") ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {slotStatuses.includes("uploading") ? "Mengunggah Foto..." : "Menyimpan..."}
                    </>
                  ) : (
                    "Simpan Produk"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
