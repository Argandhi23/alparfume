"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "alparfume_vid";

function getOrCreateVisitorId(): string {
  try {
    let vid = localStorage.getItem(STORAGE_KEY);
    if (!vid || vid.length < 8) {
      vid = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(STORAGE_KEY, vid);
    }
    return vid;
  } catch {
    // Fallback if localStorage is disabled in incognito
    return `vid_anon_${Date.now()}`;
  }
}

function detectDevice(): string {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Tablet/i.test(ua);

  if (isTabletUA || (window.innerWidth >= 768 && window.innerWidth < 1024)) {
    return "tablet";
  }
  if (isMobileUA || window.innerWidth < 768) {
    return "mobile";
  }
  return "desktop";
}

function getCleanReferrer(): string {
  if (typeof document === "undefined" || !document.referrer) return "direct";
  try {
    const refUrl = new URL(document.referrer);
    // Ignore internal navigation within same hostname
    if (refUrl.hostname === window.location.hostname) {
      return "direct";
    }
    return refUrl.hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTrackedRef = useRef<{ path: string; time: number }>({ path: "", time: 0 });

  useEffect(() => {
    // 1. Never track admin pages or internal APIs
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return;
    }

    // 2. Prevent duplicate tracks within 3 seconds for the same route (handles React StrictMode)
    const now = Date.now();
    if (lastTrackedRef.current.path === pathname && now - lastTrackedRef.current.time < 3000) {
      return;
    }
    lastTrackedRef.current = { path: pathname, time: now };

    // 3. Defer slightly to not compete with critical initial page load rendering
    const timeout = setTimeout(() => {
      try {
        const sessionId = getOrCreateVisitorId();
        const deviceType = detectDevice();
        const referrer = getCleanReferrer();

        const payload = JSON.stringify({
          session_id: sessionId,
          path: pathname,
          referrer,
          device_type: deviceType,
        });

        // Use fetch with keepalive for non-blocking asynchronous transmission
        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Silent catch to never disrupt user experience
        });
      } catch {
        // Safe fail
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
}
