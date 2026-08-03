import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, getServiceClient } from "@/lib/adminAuth";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminSession(request);
    if (!auth.isAuthorized) {
      return auth.errorResponse!;
    }

    const serviceClient = getServiceClient();

    // 1. Fetch created_at and grand_total from new 'orders' table
    const { data: ordersData, error: ordersError } = await serviceClient
      .from("orders")
      .select("created_at, grand_total")
      .order("created_at", { ascending: true });

    let data = ordersData;

    // 2. Fallback to 'order_intents' if orders is empty
    if (ordersError || !data || data.length === 0) {
      const fallbackResult = await serviceClient
        .from("order_intents")
        .select("created_at, price")
        .order("created_at", { ascending: true });

      if (!fallbackResult.error && fallbackResult.data) {
        data = fallbackResult.data.map(item => ({
          created_at: item.created_at,
          grand_total: item.price
        }));
      }
    }

    // Aggregate data by date
    const dailyData: Record<string, { date: string; sales: number; revenue: number }> = {};

    // Generate last 30 days
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyData[dateStr] = { date: dateStr, sales: 0, revenue: 0 };
    }

    // Populate daily data
    data?.forEach((item) => {
      if (!item.created_at) return;
      const dateStr = item.created_at.split("T")[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].sales += 1;
        dailyData[dateStr].revenue += Number(item.grand_total || 0);
      }
    });

    const result = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (err) {
    console.error("API Route Error in /api/admin/stats:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
