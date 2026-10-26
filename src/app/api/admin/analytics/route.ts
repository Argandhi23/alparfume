import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";
import { calculateAnalytics, getLocalSiteVisits } from "@/lib/analyticsHelper";
import { SiteVisit } from "@/lib/supabase";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin session token
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const serviceClient = getServiceClient();

    // 2. Fetch site visits from Supabase
    let visits: SiteVisit[] = [];
    let dataSource = "supabase";

    try {
      const { data: dbVisits, error: dbError } = await serviceClient
        .from("site_visits")
        .select("id, session_id, path, referrer, device_type, created_at")
        .order("created_at", { ascending: false })
        .limit(20000);

      if (!dbError && dbVisits && dbVisits.length > 0) {
        visits = dbVisits as SiteVisit[];
      } else {
        if (dbError) {
          console.warn("Supabase site_visits query note:", dbError.message);
        }
      }
    } catch (err) {
      console.warn("Supabase site_visits fetch exception:", err);
    }

    // 3. Graceful fallback/merge if Supabase has no data or table is empty
    if (visits.length === 0) {
      const localVisits = getLocalSiteVisits();
      if (localVisits.length > 0) {
        visits = localVisits;
        dataSource = "local";
      }
    }

    // 4. Calculate aggregated metrics
    const analytics = calculateAnalytics(visits);

    return NextResponse.json({
      success: true,
      dataSource,
      totalRecords: visits.length,
      analytics,
    });
  } catch (err) {
    console.error("Admin analytics route exception:", err);
    return NextResponse.json(
      { error: "Gagal memproses data analitik" },
      { status: 500 }
    );
  }
}
