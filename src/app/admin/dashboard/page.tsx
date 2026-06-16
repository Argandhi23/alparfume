"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, ProductWithVariants, OrderIntent } from "@/lib/supabase";
import { formatRupiah } from "@/lib/whatsapp";
import { 
  Plus, Edit2, Trash2, LogOut, Loader2, 
  ToggleLeft, ToggleRight, X, FileText, CheckCircle2, ArrowLeft,
  RefreshCw, Settings, ChevronLeft, ChevronRight
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DashboardCharts from "@/components/DashboardCharts";

export default function AdminDashboard() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "intents">("products");
  
  // Data States
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [intents, setIntents] = useState<OrderIntent[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Stats & Pagination States
  const [statsData, setStatsData] = useState<{ date: string; sales: number; revenue: number }[]>([]);
  const [intentsPage, setIntentsPage] = useState(1);
  const [intentsLimit] = useState(10);
  const [totalIntentsCount, setTotalIntentsCount] = useState(0);

  // Checkbox multi-select states
  const [selectedIntentIds, setSelectedIntentIds] = useState<string[]>([]);

  // Settings Credentials States
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  // Delete Intents States
  const [deleteIntentTargetIds, setDeleteIntentTargetIds] = useState<string[]>([]);
  const [isDeleteIntentModalOpen, setIsDeleteIntentModalOpen] = useState(false);
  const [deletingIntent, setDeletingIntent] = useState(false);

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
  const [formIsSoldOut, setFormIsSoldOut] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Image Crop States
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number>(0);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 160, y: 160 });
  const [dimensions, setDimensions] = useState({ width: 320, height: 320 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement | null>(null);

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
    const size = 800; // Output image size (High resolution 800x800 square for crystal clear display)
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calculate scaling factor between 320px crop area and 800px output canvas
    const scale = size / 320;
    
    // Relative position calculation
    const dx = (position.x - (dimensions.width * zoom) / 2) * scale;
    const dy = (position.y - (dimensions.height * zoom) / 2) * scale;
    const dw = (dimensions.width * zoom) * scale;
    const dh = (dimensions.height * zoom) * scale;

    // Draw background color and image
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(imageRef.current, dx, dy, dw, dh);

    // Convert to compressed jpeg at 0.90 quality for high-fidelity rendering without large payload size
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" });
      handleSlotUpload(cropTargetIndex, croppedFile);
      setIsCropModalOpen(false);
    }, "image/jpeg", 0.90);
  };

  // Delete State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check Session & Auth Listeners
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.replace("/admin/login");
      } else {
        setLoadingSession(false);
        fetchData();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const fetchProducts = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .order("is_sold_out", { ascending: true })
        .order("created_at", { ascending: false });
      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (err) {
      console.error("Gagal mengambil data produk:", err);
    }
  };

  const fetchIntents = async (page: number) => {
    setLoadingData(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/admin/intents?page=${page}&limit=${intentsLimit}`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intents: ${response.statusText}`);
      }

      const result = await response.json();
      setIntents(result.data || []);
      setTotalIntentsCount(result.totalCount || 0);
      setIntentsPage(page);
      setSelectedIntentIds([]); // Clear selection when page changes
    } catch (err) {
      console.error("Gagal mengambil data riwayat pesanan:", err);
    } finally {
      setLoadingData(false);
    }
  };
 
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/admin/intents?limit=all`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch intents for export: ${response.statusText}`);
      }

      const result = await response.json();
      const allIntents: OrderIntent[] = result.data || [];

      if (allIntents.length === 0) {
        alert("Tidak ada data pendapatan untuk diekspor.");
        return;
      }

      // Generate HTML Excel contents
      const title = "LAPORAN PENDAPATAN AL PARFUME";
      const printDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let totalRevenue = 0;
      let rowsHtml = "";

      allIntents.forEach((order, index) => {
        totalRevenue += order.price;
        const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        // Parse items details if available
        let productDetails = "";
        if (order.items_json) {
          try {
            const items = JSON.parse(order.items_json);
            if (Array.isArray(items)) {
              productDetails = items
                .map((item) => `- ${item.productName} ${item.sizeMl}ml (Qty: ${item.quantity || 1})`)
                .join("<br>");
            }
          } catch {
            productDetails = `${order.product_name} (${order.size_ml}ml)`;
          }
        } else {
          productDetails = `${order.product_name} (${order.size_ml}ml)`;
        }

        rowsHtml += `
          <tr>
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; white-space: nowrap;">${orderDate}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; font-weight: 500;">${order.customer_name || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; mso-number-format:'\@';">${order.customer_wa || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px;">${order.customer_address || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; font-family: monospace; font-size: 11px;">${productDetails}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; font-style: italic;">${order.order_notes || "-"}</td>
            <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">${order.price}</td>
          </tr>
        `;
      });

      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Laporan Pendapatan</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <h2 style="margin: 0; color: #111827;">${title}</h2>
          <p style="margin: 4px 0 24px 0; font-size: 12px; color: #4b5563;">Tanggal Cetak: ${printDate}</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 13px;">
            <thead>
              <tr style="background-color: #1f2937; color: #ffffff;">
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: center; width: 50px;">No</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 150px;">Tanggal Pesanan</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 180px;">Nama Pelanggan</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 130px;">No. WhatsApp</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 300px;">Alamat COD / Pengiriman</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 250px;">Detail Produk</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: left; width: 200px;">Catatan Order</th>
                <th style="border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: right; width: 120px;">Total Bayar (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="7" style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">TOTAL PENDAPATAN:</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; color: #059669;">${totalRevenue}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Download file client-side
      const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Laporan_Pendapatan_AlParfume_${Date.now()}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mengekspor data ke Excel:", err);
      alert("Gagal mengekspor data ke Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();
      setStatsData(data || []);
    } catch (err) {
      console.error("Gagal mengambil data statistik:", err);
    }
  };

  const fetchData = async () => {
    setLoadingData(true);
    await Promise.all([fetchProducts(), fetchIntents(1), fetchStats()]);
    setLoadingData(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  const openSettingsModal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSettingsEmail(session?.user?.email || "");
    setSettingsPassword("");
    setSettingsConfirmPassword("");
    setSettingsError("");
    setSettingsSuccess("");
    setIsSettingsModalOpen(true);
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");

    if (!settingsEmail.trim() && !settingsPassword.trim()) {
      setSettingsError("Masukkan email baru atau password baru.");
      return;
    }

    if (settingsPassword && settingsPassword !== settingsConfirmPassword) {
      setSettingsError("Konfirmasi password tidak cocok.");
      return;
    }

    setSettingsLoading(true);
    try {
      const updateData: { email?: string; password?: string } = {};
      if (settingsEmail.trim()) {
        updateData.email = settingsEmail.trim();
      }
      if (settingsPassword.trim()) {
        updateData.password = settingsPassword.trim();
      }

      const { error } = await supabase.auth.updateUser(updateData);
      if (error) throw error;

      setSettingsSuccess("Kredensial berhasil diperbarui!");
      setSettingsPassword("");
      setSettingsConfirmPassword("");
    } catch (err) {
      console.error("Gagal memperbarui kredensial:", err);
      const msg = err instanceof Error ? err.message : "Gagal memperbarui kredensial.";
      setSettingsError(msg);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleDeleteIntents = async () => {
    if (deleteIntentTargetIds.length === 0) return;
    setDeletingIntent(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/admin/intents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ ids: deleteIntentTargetIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete intents: ${response.statusText}`);
      }

      // Clear selections and refresh
      setSelectedIntentIds([]);
      setIsDeleteIntentModalOpen(false);
      
      const remainingOnPage = intents.length - deleteIntentTargetIds.length;
      const targetPage = remainingOnPage === 0 && intentsPage > 1 ? intentsPage - 1 : intentsPage;
      
      await Promise.all([fetchIntents(targetPage), fetchStats()]);
    } catch (err) {
      console.error("Gagal menghapus riwayat pesanan:", err);
      alert("Gagal menghapus riwayat pesanan. Silakan coba lagi.");
    } finally {
      setDeletingIntent(false);
      setDeleteIntentTargetIds([]);
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
    setFormTopNotes("");
    setFormMiddleNotes("");
    setFormBottomNotes("");
    setFormIsActive(true);
    setFormIsSoldOut(false);
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
    setFormIsSoldOut(product.is_sold_out || false);
    
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
              is_active: formIsActive,
              is_sold_out: formIsSoldOut
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
            is_active: formIsActive,
            is_sold_out: formIsSoldOut
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
      // Clean up product images in storage before deleting the database rows
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

  const handleCloseModal = async () => {
    // Clean up uploaded images in storage if we cancel adding a new product
    if (modalType === "add") {
      const pathsToDelete = formImages
        .filter((url): url is string => !!url)
        .map((url) => getStoragePathFromUrl(url))
        .filter((path): path is string => !!path);

      if (pathsToDelete.length > 0) {
        try {
          await supabase.storage.from("product-images").remove(pathsToDelete);
        } catch (err) {
          console.error("Gagal membersihkan gambar yang batal disimpan:", err);
        }
      }
    }
    setIsModalOpen(false);
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

  const totalRevenue = statsData.reduce((sum, item) => sum + item.revenue, 0);
  const totalSalesCount = statsData.reduce((sum, item) => sum + item.sales, 0);
  const activeProductsCount = products.filter((p) => p.is_active).length;

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans pb-24">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-plus-jakarta text-lg font-semibold text-neutral-900">Al Parfume Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openSettingsModal}
              className="flex items-center gap-2 border border-neutral-200 px-5 py-2 text-xs uppercase tracking-wider font-medium rounded-full transition-colors duration-200 text-neutral-700 bg-white hover:bg-neutral-50 font-sans shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              Pengaturan Akun
            </button>
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
        {/* Ringkasan Bisnis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6 font-sans">
          <div className="border border-neutral-100 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Total Volume Penjualan (30 Hari)</span>
            <span className="text-2xl font-bold font-plus-jakarta text-neutral-900 mt-2">{totalSalesCount} Pesanan</span>
          </div>
          <div className="border border-neutral-100 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Total Pendapatan (30 Hari)</span>
            <span className="text-2xl font-bold font-plus-jakarta text-emerald-600 mt-2">{formatRupiah(totalRevenue)}</span>
          </div>
          <div className="border border-neutral-100 bg-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Produk Aktif</span>
            <span className="text-2xl font-bold font-plus-jakarta text-neutral-900 mt-2">{activeProductsCount} Produk</span>
          </div>
        </div>

        {/* Charts */}
        <DashboardCharts data={statsData} />

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-100 mb-8">
          <button
            onClick={() => {
              setActiveTab("products");
              fetchData();
            }}
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
            onClick={() => {
              setActiveTab("intents");
              fetchData();
            }}
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
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-plus-jakarta text-neutral-900">Riwayat Klik WhatsApp</h2>
                <p className="text-xs text-neutral-500 font-sans">Melihat daftar produk yang diminati pelanggan sebelum menuju WhatsApp</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedIntentIds.length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteIntentTargetIds(selectedIntentIds);
                      setIsDeleteIntentModalOpen(true);
                    }}
                    className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold flex items-center gap-2 transition-all duration-200 font-sans shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Terpilih ({selectedIntentIds.length})
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  disabled={loadingData || exportingExcel}
                  className="border border-green-200 hover:bg-green-50 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold flex items-center gap-2 transition-all duration-200 font-sans bg-white text-green-700 shadow-sm"
                >
                  {exportingExcel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-green-600" />
                  )}
                  {exportingExcel ? "Mengekspor..." : "Ekspor Excel"}
                </button>
                <button
                  onClick={() => fetchIntents(intentsPage)}
                  disabled={loadingData}
                  className="border border-neutral-200 hover:bg-neutral-50 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold flex items-center gap-2 transition-all duration-200 font-sans bg-white text-neutral-700 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`} />
                  {loadingData ? "Memuat..." : "Segarkan"}
                </button>
              </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-400 tracking-wider uppercase font-semibold text-[10px] font-sans">
                        <th className="py-4 px-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={intents.length > 0 && selectedIntentIds.length === intents.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIntentIds(intents.map((int) => int.id.toString()));
                              } else {
                                setSelectedIntentIds([]);
                              }
                            }}
                            className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer"
                          />
                        </th>
                        <th className="py-4 px-6">Tanggal & Waktu</th>
                        <th className="py-4 px-6">Pelanggan</th>
                        <th className="py-4 px-6">WhatsApp</th>
                        <th className="py-4 px-6">Alamat COD</th>
                        <th className="py-4 px-6">Detail Pesanan</th>
                        <th className="py-4 px-6">Catatan</th>
                        <th className="py-4 px-6">Total Harga</th>
                        <th className="py-4 px-6 text-right w-16">Aksi</th>
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
                            <td className="py-4 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIntentIds.includes(int.id.toString())}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIntentIds([...selectedIntentIds, int.id.toString()]);
                                  } else {
                                    setSelectedIntentIds(selectedIntentIds.filter((id) => id !== int.id.toString()));
                                  }
                                }}
                                className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4 cursor-pointer"
                              />
                            </td>
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
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() => {
                                  setDeleteIntentTargetIds([int.id.toString()]);
                                  setIsDeleteIntentModalOpen(true);
                                }}
                                className="text-neutral-400 hover:text-red-600 transition-colors p-1.5 hover:bg-neutral-50 rounded-full"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalIntentsCount > intentsLimit && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                    <div className="text-xs text-neutral-500">
                      Menampilkan <span className="font-medium">{(intentsPage - 1) * intentsLimit + 1}</span> sampai{" "}
                      <span className="font-medium">{Math.min(intentsPage * intentsLimit, totalIntentsCount)}</span> dari{" "}
                      <span className="font-medium">{totalIntentsCount}</span> pesanan
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => fetchIntents(intentsPage - 1)}
                        disabled={intentsPage === 1 || loadingData}
                        className="border border-neutral-200 hover:bg-neutral-50 p-2 rounded-lg text-neutral-700 bg-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        title="Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      {Array.from({ length: Math.ceil(totalIntentsCount / intentsLimit) }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => fetchIntents(p)}
                          disabled={loadingData}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                            p === intentsPage
                              ? "bg-black text-white"
                              : "border border-neutral-200 hover:bg-neutral-50 bg-white text-neutral-700"
                          }`}
                        >
                          {p}
                        </button>
                      ))}

                      <button
                        onClick={() => fetchIntents(intentsPage + 1)}
                        disabled={intentsPage === Math.ceil(totalIntentsCount / intentsLimit) || loadingData}
                        className="border border-neutral-200 hover:bg-neutral-50 p-2 rounded-lg text-neutral-700 bg-white disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        title="Berikutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
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
              onClick={handleCloseModal}
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

                  {/* Status Stok (Sold Out) */}
                  <div className="flex items-center justify-between py-2.5 border-t border-neutral-100">
                    <div className="space-y-0.5">
                      <span className="text-xs tracking-wider text-neutral-400 uppercase font-semibold font-sans">Stok Habis (Sold Out)</span>
                      <span className="text-[10px] text-neutral-400 font-sans">Tampilkan label stok habis dan nonaktifkan tombol beli</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsSoldOut(!formIsSoldOut)}
                      className="text-brandBlack focus:outline-none"
                    >
                      {formIsSoldOut ? (
                        <ToggleRight className="w-10 h-10 text-red-500" />
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
                                      handleFileSelect(index, e.target.files[0]);
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
                                      handleFileSelect(index, e.target.files[0]);
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
                  onClick={handleCloseModal}
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

      {/* ACCOUNT SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-neutral-100 p-8 shadow-xl relative animate-slide-up rounded-2xl text-xs">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-black transition-colors p-1.5 hover:bg-neutral-50 rounded-full"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2 mb-6">
              <h3 className="font-plus-jakarta text-xl font-bold text-neutral-900">
                Pengaturan Akun Admin
              </h3>
              <p className="text-xs text-neutral-400 font-sans">
                Ubah email login dan password untuk akun admin Anda.
              </p>
            </div>

            <form onSubmit={handleUpdateCredentials} className="space-y-5">
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
                <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold font-sans">
                  Alamat Email Baru
                </label>
                <input
                  type="email"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors font-sans text-neutral-800"
                  placeholder="admin@alparfume.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold font-sans">
                  Password Baru (Kosongkan jika tidak ingin diubah)
                </label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors font-sans text-neutral-800"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              {settingsPassword.trim() !== "" && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-400 block font-semibold font-sans">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    value={settingsConfirmPassword}
                    onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors font-sans text-neutral-800"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="border border-neutral-200 hover:bg-neutral-50 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold text-neutral-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="bg-black text-white hover:bg-neutral-800 disabled:opacity-50 px-6 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors flex items-center gap-2"
                >
                  {settingsLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE INTENTS CONFIRMATION MODAL */}
      {isDeleteIntentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm border border-neutral-100 rounded-2xl bg-white p-6 space-y-6 shadow-sm animate-slide-up relative text-xs font-sans">
            <div className="space-y-2">
              <h3 className="font-plus-jakarta text-lg font-bold text-neutral-900 leading-tight">
                Hapus Riwayat Pesanan?
              </h3>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Apakah Anda yakin ingin menghapus {deleteIntentTargetIds.length} riwayat pesanan yang dipilih? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 font-sans">
              <button
                type="button"
                disabled={deletingIntent}
                onClick={() => {
                  setIsDeleteIntentModalOpen(false);
                  setDeleteIntentTargetIds([]);
                }}
                className="border border-neutral-200 hover:bg-neutral-50 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors text-neutral-600 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingIntent}
                onClick={handleDeleteIntents}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors flex items-center gap-2"
              >
                {deletingIntent ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE CROP MODAL */}
      {isCropModalOpen && cropImageSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md border border-neutral-800 rounded-2xl bg-neutral-900 p-6 space-y-6 shadow-xl animate-slide-up relative text-xs text-white">
            <div className="space-y-2">
              <h3 className="font-plus-jakarta text-lg font-bold text-white leading-tight">
                Crop Foto Produk
              </h3>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Geser (drag) gambar untuk menyesuaikan posisi. Gunakan slider di bawah untuk zoom.
              </p>
            </div>

            {/* Cropping Canvas Viewport */}
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
                {/* Image element being cropped */}
                <img
                  ref={imageRef}
                  src={cropImageSrc}
                  alt="Target crop"
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
                
                {/* Subtle crop bounds box overlay */}
                <div className="absolute inset-0 border border-white/30 rounded-xl pointer-events-none" />
                <div className="absolute inset-4 border border-dashed border-white/20 rounded-lg pointer-events-none" />
              </div>
            </div>

            {/* Zoom Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-sans font-medium">
                <span>Skala Zoom</span>
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 font-sans pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCropModalOpen(false);
                  setCropImageSrc(null);
                }}
                className="border border-neutral-700 hover:bg-neutral-800 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors text-neutral-300"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCropSave}
                className="bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors font-sans"
              >
                Crop & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
