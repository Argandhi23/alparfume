import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export interface AdminAuthResult {
  isAuthorized: boolean;
  errorResponse?: NextResponse;
  userId?: string;
  email?: string;
}

/**
 * Helper to verify Supabase admin bearer token from request Authorization header
 */
export async function verifyAdminSession(request: NextRequest): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Missing authorization token" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Empty authorization token" },
        { status: 401 }
      ),
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: "Server Configuration Error" },
        { status: 500 }
      ),
    };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser(token);

  if (authError || !user) {
    return {
      isAuthorized: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or expired session token" },
        { status: 401 }
      ),
    };
  }

  return {
    isAuthorized: true,
    userId: user.id,
    email: user.email || `admin_${user.id.slice(0, 8)}@alparfume.com`,
  };
}

/**
 * Returns a Supabase service role client for secure server-side operations
 */
export function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase server credentials");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
