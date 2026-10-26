import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";
import { getLocalTestimonials, saveLocalTestimonials } from "@/lib/testimonialsHelper";
import { Testimonial } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("testimonials")
      .select("*, products(id, name, slug, image_url)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return NextResponse.json({ success: true, data, source: "supabase" });
    }
  } catch (err) {
    console.warn("Supabase testimonials query note:", err);
  }

  // Graceful fallback to local JSON storage
  const localData = getLocalTestimonials();
  return NextResponse.json({ success: true, data: localData, source: "local" });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin session defensively
    let isAuthorized = false;
    let authErrorMsg = "Sesi login admin tidak valid atau kedaluwarsa.";
    try {
      const auth = await verifyAdminSession(request);
      if (auth.isAuthorized) {
        isAuthorized = true;
      } else if (auth.errorResponse) {
        const errJson = await auth.errorResponse.json().catch(() => ({}));
        if (errJson?.error) authErrorMsg = errJson.error;
      }
    } catch (e) {
      console.warn("Auth verify exception:", e);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: authErrorMsg }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      customer_name,
      customer_avatar_url,
      rating,
      product_id,
      product_name_override,
      review_text,
      tag,
      image_url,
      is_verified_buyer,
      is_active,
      sort_order,
    } = body;

    if (!customer_name || !customer_name.trim() || !review_text || !review_text.trim()) {
      return NextResponse.json(
        { error: "Nama pelanggan dan isi ulasan wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const safeProductId =
      product_id && typeof product_id === "string" && product_id.trim().length > 0
        ? product_id.trim()
        : null;

    // Fetch product details for relational link if safeProductId is provided
    let productDetails: { id: string; name: string; slug: string; image_url?: string | null } | null = null;
    if (safeProductId) {
      try {
        const { data: prod } = await supabase
          .from("products")
          .select("id, name, slug, image_url")
          .eq("id", safeProductId)
          .maybeSingle();
        if (prod) {
          productDetails = prod;
        }
      } catch {
        // ignore product lookup error
      }
    }

    const newId = `testi-${Date.now()}`;
    const newTestimonial: Testimonial = {
      id: newId,
      customer_name: customer_name.trim(),
      customer_avatar_url: customer_avatar_url && typeof customer_avatar_url === "string" ? customer_avatar_url.trim() : null,
      rating: Number(rating) || 5,
      product_id: safeProductId,
      product_name_override: product_name_override && typeof product_name_override === "string" ? product_name_override.trim() : null,
      review_text: review_text.trim(),
      tag: tag && typeof tag === "string" ? tag.trim() : null,
      image_url: image_url && typeof image_url === "string" ? image_url.trim() : null,
      is_verified_buyer: is_verified_buyer ?? true,
      is_active: is_active ?? true,
      sort_order: Number(sort_order) || 0,
      created_at: new Date().toISOString(),
      products: productDetails,
    };

    // 1. Attempt to insert into Supabase testimonials table (if table exists)
    let savedToSupabase = false;
    try {
      const { data: insertedData, error: insertError } = await supabase
        .from("testimonials")
        .insert([
          {
            customer_name: newTestimonial.customer_name,
            customer_avatar_url: newTestimonial.customer_avatar_url,
            rating: newTestimonial.rating,
            product_id: newTestimonial.product_id,
            product_name_override: newTestimonial.product_name_override,
            review_text: newTestimonial.review_text,
            tag: newTestimonial.tag,
            image_url: newTestimonial.image_url,
            is_verified_buyer: newTestimonial.is_verified_buyer,
            is_active: newTestimonial.is_active,
            sort_order: newTestimonial.sort_order,
          },
        ])
        .select()
        .maybeSingle();

      if (!insertError && insertedData) {
        savedToSupabase = true;
        newTestimonial.id = insertedData.id;
      }
    } catch (dbErr) {
      console.warn("Notice: Table 'testimonials' not in Supabase yet, falling back to JSON:", dbErr);
    }

    // 2. Persist to local JSON store
    const localList = getLocalTestimonials();
    const updatedList = [newTestimonial, ...localList];
    saveLocalTestimonials(updatedList);

    // 3. Revalidate homepage cache
    try {
      revalidatePath("/");
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      data: newTestimonial,
      savedToSupabase,
      message: "Ulasan berhasil disimpan!",
    });
  } catch (err: unknown) {
    console.error("Gagal menyimpan testimoni:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let isAuthorized = false;
    let authErrorMsg = "Sesi login admin tidak valid atau kedaluwarsa.";
    try {
      const auth = await verifyAdminSession(request);
      if (auth.isAuthorized) {
        isAuthorized = true;
      } else if (auth.errorResponse) {
        const errJson = await auth.errorResponse.json().catch(() => ({}));
        if (errJson?.error) authErrorMsg = errJson.error;
      }
    } catch (e) {
      console.warn("Auth verify exception:", e);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: authErrorMsg }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID testimoni wajib disertakan." }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 1. Update Supabase if table exists and id is UUID
    if (!id.startsWith("testi-")) {
      try {
        await supabase.from("testimonials").update(updates).eq("id", id);
      } catch (err) {
        console.warn("Supabase update error:", err);
      }
    }

    // 2. Update local JSON
    const localList = getLocalTestimonials();
    const index = localList.findIndex((t) => t.id === id);
    if (index !== -1) {
      localList[index] = { ...localList[index], ...updates };
      saveLocalTestimonials(localList);
    }

    try {
      revalidatePath("/");
    } catch {
      // ignore
    }
    return NextResponse.json({ success: true, message: "Ulasan berhasil diperbarui!" });
  } catch (err: unknown) {
    console.error("Gagal update testimoni:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let isAuthorized = false;
    let authErrorMsg = "Sesi login admin tidak valid atau kedaluwarsa.";
    try {
      const auth = await verifyAdminSession(request);
      if (auth.isAuthorized) {
        isAuthorized = true;
      } else if (auth.errorResponse) {
        const errJson = await auth.errorResponse.json().catch(() => ({}));
        if (errJson?.error) authErrorMsg = errJson.error;
      }
    } catch (e) {
      console.warn("Auth verify exception:", e);
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: authErrorMsg }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID testimoni wajib disertakan." }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 1. Delete from Supabase if UUID
    if (!id.startsWith("testi-")) {
      try {
        await supabase.from("testimonials").delete().eq("id", id);
      } catch (err) {
        console.warn("Supabase delete error:", err);
      }
    }

    // 2. Delete from local JSON
    const localList = getLocalTestimonials();
    const updatedList = localList.filter((t) => t.id !== id);
    saveLocalTestimonials(updatedList);

    try {
      revalidatePath("/");
    } catch {
      // ignore
    }
    return NextResponse.json({ success: true, message: "Ulasan berhasil dihapus!" });
  } catch (err: unknown) {
    console.error("Gagal menghapus testimoni:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
