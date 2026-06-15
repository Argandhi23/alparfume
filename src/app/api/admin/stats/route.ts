import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 1. Get token from authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // 2. Initialize temporary client with user's token to check auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // 3. Authenticated! Fetch using service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!serviceKey) {
      return NextResponse.json({ error: "Server Configuration Error: Missing Service Key" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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
