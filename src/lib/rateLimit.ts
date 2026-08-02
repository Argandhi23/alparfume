import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitStore>();

// Cleanup stale rate limit records every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  ipStore.forEach((record, ip) => {
    if (now > record.resetTime) {
      ipStore.delete(ip);
    }
  });
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter helper for Next.js API Routes
 * @param request NextRequest
 * @param maxRequests Maximum requests allowed within window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(
  request: NextRequest,
  maxRequests: number = 15,
  windowMs: number = 60 * 1000
): { success: boolean; response?: NextResponse } {
  // Extract client IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = (forwardedFor ? forwardedFor.split(",")[0] : realIp) || "127.0.0.1";

  const now = Date.now();
  const record = ipStore.get(ip);

  if (!record || now > record.resetTime) {
    ipStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Terlalu banyak permintaan (Rate Limit Exceeded). Silakan coba lagi nanti." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        }
      ),
    };
  }

  record.count += 1;
  return { success: true };
}
