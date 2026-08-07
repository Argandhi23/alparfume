"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, ProductWithVariants, Category } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { 
  Plus, Edit2, Trash2, Loader2, X, Image as ImageIcon
} from "lucide-react";
import Image from "next/image";

export default function ProductsPage() {
  // Data States
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"add" | "edit">("add");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formTopNotes, setFormTopNotes] = useState("");
  const [formMiddleNotes, setFormMiddleNotes] = useState("");
  const [formBottomNotes, setFormBottomNotes] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImages, setFormImages] = useState<(string | null)[]>([null, null, null]);
  const [slotStatuses, setSlotStatuses] = useState<("idle" | "uploading" | "error")[]>(["idle", "idle", "idle"]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formIsSoldOut, setFormIsSoldOut] = useState(false);
  const [formIsBestSeller, setFormIsBestSeller] = useState(false);
  const [formPrice, setFormPrice] = useState<number>(45000);
  const [formSizeMl, setFormSizeMl] = useState<number>(30);
  const [formStock, setFormStock] = useState<number>(10);

  // Image Crop States
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 160, y: 160 });
  const [dimensions, setDimensions] = useState({ width: 320, height: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Delete State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!error && data) {
        const catList = [...data];
        const hasSample = catList.some(
          (c) => c.slug === "sample" || c.name.toLowerCase().includes("sample")
        );
        if (!hasSample) {
          catList.unshift({
            id: "4ed0369c-e713-47d0-9e20-c267c05833c7",
            name: "Sample",
            slug: "sample",
            sort_order: 1,
            image_url: null,
            bg_color: "bg-neutral-300",
          });
        }
        setCategories(catList);
      }
    } catch (err) {
      console.error("Gagal mengambil data kategori:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .order("is_sold_out", { ascending: true })
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      const items: ProductWithVariants[] = productsData || [];
      setProducts(items);
    } catch (err) {
      console.error("Gagal mengambil data produk:", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([fetchProducts(), fetchCategories()]);
    setLoadingData(false);
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileSelect = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropTargetIndex(index);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const containerSize = 320;
    const ar = img.naturalWidth / img.naturalHeight;
    let width = containerSize;
    let height = containerSize;
    if (ar > 1) {
      width = containerSize * ar;
    } else {
      height = containerSize / ar;
    }
    setDimensions({ width, height });
    setPosition({ x: containerSize / 2, y: containerSize / 2 });
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

  const handleCropSave = () => {
    if (!imageRef.current) return;
    const canvas = document.createElement("canvas");
    const size = 800;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = size / 320;
    const dx = (position.x - (dimensions.width * zoom) / 2) * scale;
    const dy = (position.y - (dimensions.height * zoom) / 2) * scale;
    const dw = (dimensions.width * zoom) * scale;
    const dh = (dimensions.height * zoom) * scale;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(imageRef.current, dx, dy, dw, dh);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
      handleSlotUpload(cropTargetIndex, croppedFile);
      setIsCropModalOpen(false);
    }, "image/jpeg", 0.90);
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
        console.error("Gagal mengupdate gambar setelah hapus slot:", err);
      }
    }
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
    setFormCategoryId(categories[0]?.id || null);
    setFormPrice(45000);
    setFormSizeMl(30);
    setFormTopNotes("");
    setFormMiddleNotes("");
    setFormBottomNotes("");
    setFormIsActive(true);
    setFormIsSoldOut(false);
    setFormIsBestSeller(false);
    setFormStock(10);
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
    setFormDescription(product.description || "");
    
    let matchedCatId = product.category_id || null;
    if (!matchedCatId && product.product_variants && product.product_variants.length > 0 && categories.length > 0) {
      const firstSize = product.product_variants[0].size_ml;
      let matchedCat: Category | undefined;
      if (firstSize === 30) matchedCat = categories.find((c) => c.slug.includes("toilette") || c.name.toLowerCase().includes("toilette"));
      else if (firstSize <= 20) matchedCat = categories.find((c) => c.slug.includes("sample") || c.name.toLowerCase().includes("sample"));
      if (matchedCat) matchedCatId = matchedCat.id;
    }
    setFormCategoryId(matchedCatId);

    setFormTopNotes(product.top_notes || "");
    setFormMiddleNotes(product.middle_notes || "");
    setFormBottomNotes(product.bottom_notes || "");
    setFormIsActive(product.is_active);
    setFormIsSoldOut(product.is_sold_out || false);
    setFormIsBestSeller(product.is_best_seller || false);
    setFormStock(product.stock !== undefined && product.stock !== null ? product.stock : 10);

    const firstVar = product.product_variants && product.product_variants[0];
    const firstVarPrice = firstVar ? firstVar.price : 45000;
    const firstVarSize = firstVar ? firstVar.size_ml : 30;
    setFormPrice(firstVarPrice);
    setFormSizeMl(firstVarSize);

    let parsedImages: (string | null)[] = [null, null, null];
    if (product.image_url) {
      if (product.image_url.startsWith("[")) {
        try {
          const arr = JSON.parse(product.image_url);
          if (Array.isArray(arr)) {
            parsedImages = [arr[0] || null, arr[1] || null, arr[2] || null];
          }
        } catch {
          parsedImages = [product.image_url, null, null];
        }
      } else {
        parsedImages = [product.image_url, null, null];
      }
    }
    setFormImages(parsedImages);
    setSlotStatuses(["idle", "idle", "idle"]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) { setFormError("Nama produk wajib diisi"); return; }
    if (!formSlug.trim()) { setFormError("Slug produk wajib diisi"); return; }

    setSaving(true);
    try {
      const activeImages = formImages.filter(Boolean);
      const imageUrlJson = activeImages.length > 0 ? JSON.stringify(activeImages) : "";

      const stockVal = typeof formStock === "number" && !isNaN(formStock) ? formStock : Number(formStock) || 0;
      const isSoldOutVal = stockVal <= 0 ? true : formIsSoldOut;

      const productPayload = {
        name: formName.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim(),
        category_id: formCategoryId || null,
        top_notes: formTopNotes.trim() || null,
        middle_notes: formMiddleNotes.trim() || null,
        bottom_notes: formBottomNotes.trim() || null,
        is_active: formIsActive,
        is_sold_out: isSoldOutVal,
        is_best_seller: formIsBestSeller,
        stock: stockVal,
        shopee_link: null,
        image_url: imageUrlJson,
      };

      if (modalType === "add") {
        let { data: newProd, error: prodErr } = await supabase
          .from("products")
          .insert([productPayload])
          .select()
          .single();

        if (prodErr) {
          console.warn("Product add with full payload failed, trying core payload:", prodErr);
          const corePayload = {
            name: formName.trim(),
            slug: formSlug.trim(),
            description: formDescription.trim(),
            category_id: formCategoryId || null,
            is_active: formIsActive,
            is_sold_out: isSoldOutVal,
            is_best_seller: formIsBestSeller,
            stock: stockVal,
            image_url: imageUrlJson,
          };
          const fallbackRes = await supabase
            .from("products")
            .insert([corePayload])
            .select()
            .single();
          newProd = fallbackRes.data;
          prodErr = fallbackRes.error;
        }

        if (prodErr) throw prodErr;

        if (newProd) {
          const variantPayload = {
            product_id: newProd.id,
            size_ml: Number(formSizeMl) || 30,
            price: Number(formPrice) || 45000,
          };
          const { error: varErr } = await supabase.from("product_variants").insert([variantPayload]);
          if (varErr) console.warn("Variant add notice:", varErr);
        }
      } else if (modalType === "edit" && selectedProductId) {
        let { error: prodErr } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", selectedProductId);

        if (prodErr) {
          console.warn("Product update with full payload failed, trying core payload:", prodErr);
          const corePayload = {
            name: formName.trim(),
            slug: formSlug.trim(),
            description: formDescription.trim(),
            category_id: formCategoryId || null,
            top_notes: formTopNotes.trim() || null,
            middle_notes: formMiddleNotes.trim() || null,
            bottom_notes: formBottomNotes.trim() || null,
            is_active: formIsActive,
            is_sold_out: isSoldOutVal,
            is_best_seller: formIsBestSeller,
            stock: stockVal,
            image_url: imageUrlJson,
          };
          const fallbackRes = await supabase
            .from("products")
            .update(corePayload)
            .eq("id", selectedProductId);
          prodErr = fallbackRes.error;
        }

        if (prodErr) {
          console.warn("Product update with core payload failed, trying minimal payload:", prodErr);
          const minimalPayload = {
            name: formName.trim(),
            stock: stockVal,
            is_active: formIsActive,
            is_sold_out: isSoldOutVal,
            image_url: imageUrlJson,
          };
          const minimalRes = await supabase
            .from("products")
            .update(minimalPayload)
            .eq("id", selectedProductId);
          prodErr = minimalRes.error;
        }

        if (prodErr) throw prodErr;

        const { data: existingVars } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product_id", selectedProductId);

        if (existingVars && existingVars.length > 0) {
          await supabase
            .from("product_variants")
            .update({
              price: Number(formPrice) || 45000,
              size_ml: Number(formSizeMl) || 30,
            })
            .eq("id", existingVars[0].id);
        } else {
          await supabase.from("product_variants").insert([{
            product_id: selectedProductId,
            size_ml: Number(formSizeMl) || 30,
            price: Number(formPrice) || 45000,
          }]);
        }
      }

      const getAuthHeader = async (): Promise<Record<string, string>> => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        } catch {
          return {};
        }
      };
      const authHeader = await getAuthHeader();

      fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ slug: formSlug.trim() }),
      }).catch(() => {});

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      console.error("Gagal menyimpan produk:", err);
      const msg = err instanceof Error ? err.message : "Gagal menyimpan data produk.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const targetProduct = products.find((p) => p.id === deleteTargetId);
      if (targetProduct && targetProduct.image_url) {
        let urls: string[] = [];
        if (targetProduct.image_url.startsWith("[")) {
          try {
            urls = JSON.parse(targetProduct.image_url);
          } catch {
            urls = [targetProduct.image_url];
          }
        } else {
          urls = [targetProduct.image_url];
        }

        const pathsToDelete = urls
          .filter(Boolean)
          .map((url) => getStoragePathFromUrl(url))
          .filter((path): path is string => !!path);

        if (pathsToDelete.length > 0) {
          await supabase.storage.from("product-images").remove(pathsToDelete);
        }
      }

      await supabase.from("product_variants").delete().eq("product_id", deleteTargetId);
      await supabase.from("products").delete().eq("id", deleteTargetId);

      if (targetProduct?.slug) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
          fetch("/api/admin/revalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ slug: targetProduct.slug }),
          }).catch(() => {});
        } catch {}
      }

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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        fetch("/api/admin/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ slug: product.slug }),
        }).catch(() => {});
      } catch {}
      fetchData();
    } catch (err) {
      console.error("Gagal mengubah status aktif produk:", err);
    }
  };

  const toggleProductSoldOut = async (product: ProductWithVariants) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_sold_out: !product.is_sold_out })
        .eq("id", product.id);

      if (error) throw error;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        fetch("/api/admin/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ slug: product.slug }),
        }).catch(() => {});
      } catch {}
      fetchData();
    } catch (err) {
      console.error("Gagal mengubah status sold out produk:", err);
    }
  };

  const toggleProductBestSeller = async (product: ProductWithVariants) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_best_seller: !product.is_best_seller })
        .eq("id", product.id);

      if (error) throw error;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        fetch("/api/admin/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ slug: product.slug }),
        }).catch(() => {});
      } catch {}
      fetchData();
    } catch (err) {
      console.error("Gagal mengubah status Best Seller produk:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Katalog Produk</h2>
          <p className="text-xs text-neutral-500 font-sans">Tambah, ubah, atau hapus koleksi parfum Anda</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-black text-white hover:bg-neutral-800 px-6 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold flex items-center gap-2 transition-colors duration-200 font-sans shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk
        </button>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-24 border border-neutral-100 rounded-2xl bg-white shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <p className="text-xs tracking-widest text-neutral-400 uppercase font-sans font-bold">Belum ada produk</p>
        </div>
      ) : (
        <div className="border border-neutral-100 bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-400 tracking-wider uppercase font-semibold text-[10px] font-sans">
                  <th className="py-4 px-6 w-20">Foto</th>
                  <th className="py-4 px-6">Nama / Slug</th>
                  <th className="py-4 px-6">Harga Varian</th>
                  <th className="py-4 px-6 w-32 text-center">Status Aktif</th>
                  <th className="py-4 px-6 w-32 text-center">Status Stok</th>
                  <th className="py-4 px-6 w-32 text-center">Best Seller</th>
                  <th className="py-4 px-6 w-32 text-center">Stok Menipis</th>
                  <th className="py-4 px-6 w-36 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-neutral-50/50 transition-colors">
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
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-900 uppercase font-sans">{prod.name}</span>
                        <span className="bg-neutral-100 border border-neutral-200 text-neutral-600 text-[10px] font-semibold px-2 py-0.5 rounded-md font-sans">
                          Stok: {prod.stock !== undefined && prod.stock !== null ? prod.stock : 0}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{prod.slug}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5 font-sans">
                        {prod.product_variants && prod.product_variants.length > 0 ? (
                          prod.product_variants.map((v) => (
                            <span key={v.id} className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-full text-[10px] font-semibold text-neutral-700">
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
                          <span className="bg-neutral-900 text-white text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            Aktif
                          </span>
                        ) : (
                          <span className="bg-neutral-100 text-neutral-500 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            Buram
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => toggleProductSoldOut(prod)}
                        className="inline-flex items-center justify-center transition-opacity hover:opacity-85 focus:outline-none"
                        title={prod.is_sold_out ? "Tandai Ready" : "Tandai Sold Out"}
                      >
                        {prod.is_sold_out ? (
                          <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            Sold Out
                          </span>
                        ) : (
                          <span className="bg-green-50 text-green-600 border border-green-200 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            Ready
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => toggleProductBestSeller(prod)}
                        className="inline-flex items-center justify-center transition-opacity hover:opacity-85 focus:outline-none"
                        title={prod.is_best_seller ? "Hapus dari Best Seller" : "Tandai Best Seller"}
                      >
                        {prod.is_best_seller ? (
                          <span className="bg-amber-500 text-white text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            ⭐ Best Seller
                          </span>
                        ) : (
                          <span className="bg-neutral-100 text-neutral-400 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans">
                            Regular
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {(prod.stock !== undefined && prod.stock < 5) ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans select-none">
                          Menipis
                        </span>
                      ) : (
                        <span className="bg-neutral-50 text-neutral-400 border border-neutral-200 text-[10px] rounded-full px-2.5 py-1 font-bold uppercase tracking-wider font-sans select-none">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="p-2 border border-neutral-200 rounded-full text-neutral-600 hover:text-black hover:bg-neutral-100 bg-white transition-all shadow-sm"
                          title="Edit Produk"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(prod.id)}
                          className="p-2 border border-rose-200 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 bg-white transition-all shadow-sm"
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
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="font-plus-jakarta text-lg font-bold text-neutral-900">
                {modalType === "add" ? "Tambah Produk Baru" : "Edit Produk"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider">Nama Produk</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => onNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                    placeholder="Contoh: BLACK OPIUM"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider">Slug URL</label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm font-mono"
                    placeholder="black-opium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider">Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider">Ukuran (ml)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formSizeMl}
                    onChange={(e) => setFormSizeMl(e.target.value === "" ? 30 : Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                    placeholder="Contoh: 30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-neutral-700 uppercase tracking-wider">Stok Produk</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-neutral-700 uppercase tracking-wider">Kategori</label>
                <select
                  value={formCategoryId || ""}
                  onChange={(e) => setFormCategoryId(e.target.value || null)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm bg-white"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-neutral-700 uppercase tracking-wider">Deskripsi Parfum</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  placeholder="Jelaskan aroma dan karakter parfum..."
                />
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-neutral-600">Top Notes</label>
                  <input
                    type="text"
                    value={formTopNotes}
                    onChange={(e) => setFormTopNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                    placeholder="Bergamot, Pear"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-neutral-600">Middle Notes</label>
                  <input
                    type="text"
                    value={formMiddleNotes}
                    onChange={(e) => setFormMiddleNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                    placeholder="Jasmine, Orange Blossom"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-neutral-600">Bottom Notes</label>
                  <input
                    type="text"
                    value={formBottomNotes}
                    onChange={(e) => setFormBottomNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                    placeholder="Vanilla, Cedarwood"
                  />
                </div>
              </div>

              {/* Image Slots */}
              <div className="space-y-2">
                <label className="block font-bold text-neutral-700 uppercase tracking-wider">Foto Produk (Maksimal 3)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((idx) => {
                    const imgUrl = formImages[idx];
                    const status = slotStatuses[idx];

                    return (
                      <div key={idx} className="relative aspect-square bg-neutral-50 border border-dashed border-neutral-300 rounded-2xl overflow-hidden flex items-center justify-center">
                        {status === "uploading" ? (
                          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                        ) : imgUrl ? (
                          <>
                            <Image src={imgUrl} alt={`Slot ${idx + 1}`} fill unoptimized className="object-cover" />
                            <button
                              type="button"
                              onClick={() => handleSlotDelete(idx)}
                              className="absolute top-2 right-2 bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 shadow-md"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-neutral-400 hover:text-black">
                            <ImageIcon className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-semibold">+ Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileSelect(idx, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
                  />
                  <span className="font-bold text-neutral-800">Tampilkan Produk (Aktif)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsSoldOut}
                    onChange={(e) => setFormIsSoldOut(e.target.checked)}
                    className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
                  />
                  <span className="font-bold text-red-600">Habis (Sold Out)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsBestSeller}
                    onChange={(e) => setFormIsBestSeller(e.target.checked)}
                    className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
                  />
                  <span className="font-bold text-amber-600">⭐ Best Seller</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 font-bold text-white bg-black hover:bg-neutral-800 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CROP MODAL FOR PRODUCT IMAGE */}
      {isCropModalOpen && cropImageSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-md bg-neutral-900 rounded-3xl p-6 space-y-6 shadow-2xl relative text-xs text-white">
            <div className="space-y-1">
              <h3 className="font-plus-jakarta text-lg font-bold text-white">Crop Foto Produk</h3>
              <p className="text-xs text-neutral-400">Geser & sesuaikan posisi gambar</p>
            </div>

            <div className="flex justify-center py-2">
              <div 
                className="w-[320px] h-[320px] relative overflow-hidden bg-neutral-950 border border-neutral-700 rounded-xl select-none cursor-move"
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
                  src={cropImageSrc}
                  alt="Crop"
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
                <div className="absolute inset-0 border border-white/30 rounded-xl pointer-events-none" />
              </div>
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
                onClick={() => setIsCropModalOpen(false)}
                className="px-5 py-2 rounded-full border border-neutral-700 hover:bg-neutral-800 text-neutral-300 font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="px-5 py-2 rounded-full bg-white text-black hover:bg-neutral-200 font-bold"
              >
                Crop & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold font-plus-jakarta text-neutral-900">Hapus Produk?</h3>
              <p className="text-sm text-neutral-500">Produk ini dan seluruh variannya akan dihapus secara permanen.</p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-6 py-2.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors"
                disabled={deleting}
              >
                Batal
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}