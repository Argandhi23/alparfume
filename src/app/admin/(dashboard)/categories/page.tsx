"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, Category, Banner } from "@/lib/supabase";
import { 
  Plus, Edit2, Trash2, Loader2, X
} from "lucide-react";
import Image from "next/image";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Category Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [categoryFormSlug, setCategoryFormSlug] = useState("");
  const [categoryFormImageUrl, setCategoryFormImageUrl] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Banner Modal States
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerFormTitle, setBannerFormTitle] = useState("");
  const [bannerFormImageUrl, setBannerFormImageUrl] = useState("");
  const [bannerFormLinkUrl, setBannerFormLinkUrl] = useState("");
  const [bannerFormIsActive, setBannerFormIsActive] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);

  // Generic Image Crop State for Banner & Category
  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    imageSrc: string;
    aspectRatio: number;
    title: string;
    targetType: "banner" | "category" | null;
  }>({
    isOpen: false,
    imageSrc: "",
    aspectRatio: 16 / 9,
    title: "Crop Gambar",
    targetType: null,
  });

  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 160, y: 160 });
  const [dimensions, setDimensions] = useState({ width: 320, height: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!error && data) {
        setCategories(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data kategori:", err);
    }
  }, []);

  const fetchBanners = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!error && data) {
        setBanners(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data banner:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([fetchCategories(), fetchBanners()]);
    setLoadingData(false);
  }, [fetchCategories, fetchBanners]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCropContainerDimensions = () => {
    const isBanner = cropModalState.targetType === "banner";
    const containerW = isBanner ? 360 : 270;
    const containerH = Math.round(containerW / cropModalState.aspectRatio);
    return { containerW, containerH };
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { containerW, containerH } = getCropContainerDimensions();

    const imgAR = img.naturalWidth / img.naturalHeight;
    let width = containerW;
    let height = containerH;

    if (imgAR > cropModalState.aspectRatio) {
      height = containerH;
      width = containerH * imgAR;
    } else {
      width = containerW;
      height = containerW / imgAR;
    }

    setDimensions({ width, height });
    setPosition({ x: containerW / 2, y: containerH / 2 });
    setZoom(1);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPosition((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    setPosition((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const [croppingImage, setCroppingImage] = useState(false);

  const handleCropSave = async () => {
    if (!imageRef.current) return;
    setCroppingImage(true);
    try {
      const { containerW } = getCropContainerDimensions();
      const canvas = document.createElement("canvas");
      
      const targetW = cropModalState.targetType === "banner" ? 1280 : 600;
      const targetH = Math.round(targetW / cropModalState.aspectRatio);
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCroppingImage(false);
        return;
      }

      const scale = targetW / containerW;
      const dx = (position.x - (dimensions.width * zoom) / 2) * scale;
      const dy = (position.y - (dimensions.height * zoom) / 2) * scale;
      const dw = (dimensions.width * zoom) * scale;
      const dh = (dimensions.height * zoom) * scale;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(imageRef.current, dx, dy, dw, dh);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      let finalImageUrl = dataUrl;

      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85)
        );
        if (blob) {
          const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
          const bucketCandidates = [
            cropModalState.targetType === "banner" ? "banner-images" : "category-images",
            "product-images"
          ];
          const filePath = `${cropModalState.targetType || "misc"}/${Date.now()}.jpg`;

          for (const bucket of bucketCandidates) {
            const { error: uploadErr } = await supabase.storage.from(bucket).upload(filePath, croppedFile, { upsert: true });
            if (!uploadErr) {
              const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
              if (data?.publicUrl) {
                finalImageUrl = data.publicUrl;
                break;
              }
            }
          }
        }
      } catch (storageErr) {
        console.warn("Storage upload notice (falling back to data URL):", storageErr);
      }

      if (cropModalState.targetType === "banner") {
        setBannerFormImageUrl(finalImageUrl);
      } else if (cropModalState.targetType === "category") {
        setCategoryFormImageUrl(finalImageUrl);
      }
      setCropModalState((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error("Crop error:", err);
      alert("Gagal memproses gambar. Silakan coba lagi.");
    } finally {
      setCroppingImage(false);
    }
  };

  const toggleBannerStatus = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from("banners")
        .update({ is_active: !banner.is_active })
        .eq("id", banner.id);
      if (error) throw error;
      fetchBanners();
    } catch (err) {
      console.error("Gagal mengubah status banner:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Banner Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Banner Promo Header</h2>
            <p className="text-xs text-neutral-500 font-sans">Kelola gambar slide banner promo di halaman utama</p>
          </div>
          <button
            onClick={() => {
              setEditingBanner(null);
              setBannerFormTitle("");
              setBannerFormImageUrl("");
              setBannerFormLinkUrl("");
              setBannerFormIsActive(true);
              setIsBannerModalOpen(true);
            }}
            className="bg-black text-white hover:bg-neutral-800 px-5 py-2 rounded-full text-xs uppercase tracking-wider font-semibold flex items-center gap-2 shadow-sm font-sans"
          >
            <Plus className="w-4 h-4" />
            Tambah Banner
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-neutral-200">
            <p className="text-xs tracking-widest text-neutral-400 uppercase font-bold">Belum ada banner</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                <div className="relative aspect-[16/9] bg-neutral-100 border-b border-neutral-100">
                  {b.image_url ? (
                    <Image src={b.image_url} alt={b.title || "Banner"} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-xs italic">Tanpa Gambar</div>
                  )}
                  <span className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                    b.is_active ? "bg-green-500 text-white" : "bg-neutral-800 text-white"
                  }`}>
                    {b.is_active ? "Aktif" : "Non-Aktif"}
                  </span>
                </div>
                <div className="p-4 space-y-3 font-sans">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">{b.title || "Banner Promo"}</h4>
                    {b.link_url && <p className="text-[10px] text-neutral-400 truncate">{b.link_url}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                    <button
                      onClick={() => toggleBannerStatus(b)}
                      className="text-xs font-semibold text-neutral-600 hover:text-black"
                    >
                      {b.is_active ? "Sembunyikan" : "Tampilkan"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingBanner(b);
                          setBannerFormTitle(b.title || "");
                          setBannerFormImageUrl(b.image_url || "");
                          setBannerFormLinkUrl(b.link_url || "");
                          setBannerFormIsActive(b.is_active);
                          setIsBannerModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Hapus banner ini?")) {
                            await supabase.from("banners").delete().eq("id", b.id);
                            fetchBanners();
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Section */}
      <div className="space-y-4 pt-4 border-t border-neutral-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Kategori Parfum</h2>
            <p className="text-xs text-neutral-500 font-sans">Atur pengelompokan kategori (misal: Sample, Eau de Toilette, Eau de Parfum, Extrait de Parfum)</p>
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryFormName("");
              setCategoryFormSlug("");
              setCategoryFormImageUrl("");
              setIsCategoryModalOpen(true);
            }}
            className="bg-black text-white hover:bg-neutral-800 px-5 py-2 rounded-full text-xs uppercase tracking-wider font-semibold flex items-center gap-2 shadow-sm font-sans"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-neutral-200">
            <p className="text-xs tracking-widest text-neutral-400 uppercase font-bold">Belum ada kategori</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="relative aspect-[3/4] bg-neutral-50 rounded-xl overflow-hidden border border-neutral-100">
                  {cat.image_url ? (
                    <Image src={cat.image_url} alt={cat.name} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-[10px] uppercase font-bold">No Image</div>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-neutral-900 uppercase font-sans truncate">{cat.name}</h4>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{cat.slug}</p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setCategoryFormName(cat.name);
                      setCategoryFormSlug(cat.slug);
                      setCategoryFormImageUrl(cat.image_url || "");
                      setIsCategoryModalOpen(true);
                    }}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Hapus kategori ini?")) {
                        await supabase.from("categories").delete().eq("id", cat.id);
                        fetchCategories();
                      }
                    }}
                    className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BANNER MODAL */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">
                {editingBanner ? "Edit Banner" : "Tambah Banner"}
              </h3>
              <button onClick={() => setIsBannerModalOpen(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingBanner(true);
                try {
                  const autoSortOrder = editingBanner
                    ? (editingBanner.sort_order ?? 0)
                    : banners.length + 1;

                  const payload = {
                    title: bannerFormTitle.trim(),
                    image_url: bannerFormImageUrl || null,
                    link_url: bannerFormLinkUrl.trim() || null,
                    sort_order: autoSortOrder,
                    is_active: bannerFormIsActive,
                  };

                  if (editingBanner) {
                    await supabase.from("banners").update(payload).eq("id", editingBanner.id);
                  } else {
                    await supabase.from("banners").insert([payload]);
                  }

                  setIsBannerModalOpen(false);
                  fetchBanners();
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Gagal menyimpan banner";
                  alert(msg);
                } finally {
                  setSavingBanner(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Judul Banner</label>
                <input
                  type="text"
                  required
                  value={bannerFormTitle}
                  onChange={(e) => setBannerFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  placeholder="Promo Diskon Akhir Tahun"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Link URL (Opsional)</label>
                <input
                  type="text"
                  value={bannerFormLinkUrl}
                  onChange={(e) => setBannerFormLinkUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  placeholder="/products/black-opium"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Gambar Banner (16:9)</label>
                {bannerFormImageUrl && (
                  <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-neutral-200 mb-2 group">
                    <Image src={bannerFormImageUrl} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setBannerFormImageUrl("")}
                      className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white p-1 rounded-full text-xs shadow"
                      title="Hapus Gambar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          setCropModalState({
                            isOpen: true,
                            imageSrc: reader.result as string,
                            aspectRatio: 16 / 9,
                            title: "Crop Banner Promo (16:9)",
                            targetType: "banner",
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200"
                  />
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-400 font-medium block mb-1">Atau tempel URL Gambar:</span>
                    <input
                      type="text"
                      value={bannerFormImageUrl}
                      onChange={(e) => setBannerFormImageUrl(e.target.value)}
                      placeholder="https://... atau data:image/..."
                      className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-black font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={bannerFormIsActive}
                  onChange={(e) => setBannerFormIsActive(e.target.checked)}
                  className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
                />
                <span className="font-bold text-neutral-800">Banner Aktif (Ditampilkan)</span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-5 py-2.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBanner}
                  className="px-5 py-2.5 font-bold text-white bg-black hover:bg-neutral-800 rounded-full flex items-center gap-2"
                >
                  {savingBanner && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-lg font-plus-jakarta text-neutral-900">
                {editingCategory ? "Edit Kategori" : "Tambah Kategori"}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingCategory(true);
                try {
                  const slug = categoryFormSlug.trim() || categoryFormName.trim().toLowerCase().replace(/\s+/g, "-");
                  const autoSortOrder = editingCategory
                    ? (editingCategory.sort_order ?? 0)
                    : categories.length + 1;

                  const payload = {
                    name: categoryFormName.trim(),
                    slug: slug,
                    image_url: categoryFormImageUrl || null,
                    sort_order: autoSortOrder,
                  };

                  if (editingCategory) {
                    await supabase.from("categories").update(payload).eq("id", editingCategory.id);
                  } else {
                    await supabase.from("categories").insert([payload]);
                  }

                  setIsCategoryModalOpen(false);
                  fetchCategories();
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Gagal menyimpan kategori";
                  alert(msg);
                } finally {
                  setSavingCategory(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Nama Kategori</label>
                <input
                  type="text"
                  required
                  value={categoryFormName}
                  onChange={(e) => {
                    setCategoryFormName(e.target.value);
                    if (!editingCategory) {
                      setCategoryFormSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  placeholder="Contoh: Eau de Parfum"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Slug URL</label>
                <input
                  type="text"
                  value={categoryFormSlug}
                  onChange={(e) => setCategoryFormSlug(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm font-mono"
                  placeholder="eau-de-parfum"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase tracking-wider mb-1">Gambar Background (3:4)</label>
                {categoryFormImageUrl && (
                  <div className="relative aspect-[3/4] w-28 rounded-xl overflow-hidden border border-neutral-200 mb-2 group">
                    <Image src={categoryFormImageUrl} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setCategoryFormImageUrl("")}
                      className="absolute top-1 right-1 bg-black/75 hover:bg-black text-white p-1 rounded-full text-xs shadow"
                      title="Hapus Gambar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          setCropModalState({
                            isOpen: true,
                            imageSrc: reader.result as string,
                            aspectRatio: 3 / 4,
                            title: "Crop Kategori (3:4)",
                            targetType: "category",
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200"
                  />
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-400 font-medium block mb-1">Atau tempel URL Gambar:</span>
                    <input
                      type="text"
                      value={categoryFormImageUrl}
                      onChange={(e) => setCategoryFormImageUrl(e.target.value)}
                      placeholder="https://... atau data:image/..."
                      className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-black font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2.5 font-bold text-white bg-black hover:bg-neutral-800 rounded-full flex items-center gap-2"
                >
                  {savingCategory && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CROP MODAL FOR CATEGORY / BANNER */}
      {cropModalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-neutral-900 rounded-3xl p-6 space-y-6 shadow-2xl relative text-xs text-white">
            <div className="space-y-1">
              <h3 className="font-plus-jakarta text-lg font-bold text-white">{cropModalState.title}</h3>
              <p className="text-xs text-neutral-400">Geser & sesuaikan posisi gambar</p>
            </div>

            <div className="flex justify-center py-2">
              {(() => {
                const { containerW, containerH } = getCropContainerDimensions();
                return (
                  <div 
                    style={{ width: `${containerW}px`, height: `${containerH}px` }}
                    className="relative overflow-hidden bg-neutral-950 border border-neutral-700 rounded-xl select-none cursor-move touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      src={cropModalState.imageSrc}
                      alt="Crop Preview"
                      className="pointer-events-none select-none max-w-none max-h-none"
                      style={{
                        position: "absolute",
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: `${dimensions.width * zoom}px`,
                        height: `${dimensions.height * zoom}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onLoad={handleImageLoad}
                    />
                    <div className="absolute inset-0 border-2 border-white/40 rounded-xl pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCropModalState({ ...cropModalState, isOpen: false })}
                className="px-5 py-2 rounded-full border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={croppingImage}
                onClick={handleCropSave}
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 font-bold text-xs flex items-center gap-2"
              >
                {croppingImage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {croppingImage ? "Memproses..." : "Crop & Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}