import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";

export const revalidate = 0; // Disable static cache to ensure the query always hits the DB

export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, 30, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }
    // Perform a lightweight query to trigger Supabase database activity
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: "ok",
      message: "Database pinged successfully",
      timestamp: new Date().toISOString(),
      dataExists: !!data
    });
  } catch (error: unknown) {
    console.error("Keep-alive ping failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        status: "error",
        message: errorMessage
      },
      { status: 500 }
    );
  }
}
