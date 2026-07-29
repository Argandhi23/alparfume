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

    // Fetch created_at and price for all intents
    const { data, error } = await serviceClient
      .from("order_intents")
      .select("created_at, price")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
        dailyData[dateStr].revenue += Number(item.price || 0);
      }
    });

    // Sort by date ascending
    const result = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (err) {
    console.error("API Route Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
