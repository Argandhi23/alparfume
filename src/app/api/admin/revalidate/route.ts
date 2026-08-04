import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Admin Session Authentication
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const body = await request.json().catch(() => ({}));
    const { path, slug } = body;

    // 2. Revalidate homepage
    revalidatePath("/");

    // 3. Revalidate concrete product & category paths if slug provided
    if (slug && typeof slug === "string") {
      const cleanSlug = slug.trim().toLowerCase();
      revalidatePath(`/products/${cleanSlug}`);
      revalidatePath(`/categories/${cleanSlug}`);
    }

    // 4. Revalidate controlled specific path if provided
    if (path && typeof path === "string" && (path.startsWith("/products/") || path.startsWith("/categories/") || path === "/")) {
      revalidatePath(path);
    }

    return NextResponse.json({
      success: true,
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Revalidation error:", err);
    return NextResponse.json({ error: "Failed to revalidate cache" }, { status: 500 });
  }
}
