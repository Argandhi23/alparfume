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

    // Parse pagination query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");

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

    let data, count, error;

    if (limitParam === "all") {
      const { data: allData, count: allCount, error: allErr } = await serviceClient
        .from("order_intents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      data = allData;
      count = allCount;
      error = allErr;
    } else {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(limitParam || "10", 10);
      const fromIndex = (page - 1) * limit;
      const toIndex = fromIndex + limit - 1;

      const { data: pageData, count: pageCount, error: pageErr } = await serviceClient
        .from("order_intents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(fromIndex, toIndex);
      data = pageData;
      count = pageCount;
      error = pageErr;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, totalCount: count || 0 });
  } catch (err) {
    console.error("API Route Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. Get token from authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // 2. Check auth
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

    // 3. Parse IDs to delete from request body
    const body = await request.json();
    const { ids } = body; // Expects an array of IDs
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Bad Request: Missing or invalid ids array" }, { status: 400 });
    }

    // 4. Perform DELETE using service role key
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

    const { error } = await serviceClient
      .from("order_intents")
      .delete()
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    console.error("API Route DELETE Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
