import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getServiceClient } from "@/lib/adminAuth";
import { recordLocalSiteVisit } from "@/lib/analyticsHelper";

// Common web crawlers and automated bots to ignore
const BOT_REGEX = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|twitterbot|pinterest|googlebot|bingbot|yandex|duckduckbot|baiduspider|headless|lighthouse/i;

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting: max 60 hits per minute per IP to prevent spam attacks
    const rateLimit = checkRateLimit(request, 60, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }

    // 2. Bot filtering based on User-Agent
    const userAgent = request.headers.get("user-agent") || "";
    if (BOT_REGEX.test(userAgent)) {
      return NextResponse.json({ success: true, ignored: true, reason: "bot" });
    }

    const body = await request.json().catch(() => ({}));
    const { session_id, path, referrer, device_type } = body;

    // Validate required fields
    if (!session_id || typeof session_id !== "string" || !session_id.trim()) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const rawPath = typeof path === "string" ? path.trim() : "/";
    const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

    // 3. Strict Admin & API exclusions: Never track admin portal or internal API calls
    if (
      cleanPath.startsWith("/admin") ||
      cleanPath.startsWith("/api") ||
      cleanPath.includes("/admin/")
    ) {
      return NextResponse.json({ success: true, ignored: true, reason: "admin_or_api_route" });
    }

    // Sanitize values
    const safeSessionId = session_id.slice(0, 128).trim();
    const safePath = cleanPath.slice(0, 255);
    const safeReferrer = typeof referrer === "string" && referrer.trim() ? referrer.slice(0, 255) : "direct";
    const safeDeviceType = typeof device_type === "string" && device_type.trim() ? device_type.slice(0, 32) : "desktop";

    const newVisit = {
      session_id: safeSessionId,
      path: safePath,
      referrer: safeReferrer,
      device_type: safeDeviceType,
      created_at: new Date().toISOString(),
    };

    // 4. Primary storage: Supabase site_visits table via Service Role
    let insertedInSupabase = false;
    try {
      const supabase = getServiceClient();
      const { error: insertError } = await supabase.from("site_visits").insert({
        session_id: newVisit.session_id,
        path: newVisit.path,
        referrer: newVisit.referrer,
        device_type: newVisit.device_type,
        created_at: newVisit.created_at,
      });

      if (!insertError) {
        insertedInSupabase = true;
      } else {
        console.warn("Supabase site_visits insert note:", insertError.message);
      }
    } catch (dbErr) {
      console.warn("Supabase site_visits connection error:", dbErr);
    }

    // 5. Automatic fallback/mirror to local JSON store
    recordLocalSiteVisit(newVisit);

    return NextResponse.json({
      success: true,
      storage: insertedInSupabase ? "supabase" : "local",
    });
  } catch (err) {
    console.error("Analytics track route error:", err);
    return NextResponse.json({ error: "Internal tracking error" }, { status: 500 });
  }
}
