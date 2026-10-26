import fs from "fs";
import path from "path";
import { SiteVisit } from "./supabase";

const JSON_FILE_PATH = path.join(process.cwd(), "src", "data", "site_visits.json");

/**
 * Safely reads site visits from the local JSON store (fallback)
 */
export function getLocalSiteVisits(): SiteVisit[] {
  try {
    if (fs.existsSync(JSON_FILE_PATH)) {
      const data = fs.readFileSync(JSON_FILE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed as SiteVisit[];
      }
    }
  } catch (err) {
    console.warn("Failed to read local site visits JSON file:", err);
  }
  return [];
}

/**
 * Safely appends a site visit to the local JSON store
 */
export function recordLocalSiteVisit(visit: SiteVisit): boolean {
  try {
    const dir = path.dirname(JSON_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = getLocalSiteVisits();
    // Keep up to 10,000 most recent records in local file to avoid unbounded growth
    if (current.length >= 10000) {
      current.shift();
    }
    current.push(visit);
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(current, null, 2), "utf8");
    return true;
  } catch (err) {
    console.warn("Failed to write to local site visits JSON file:", err);
    return false;
  }
}

export interface MetricSummary {
  uniqueVisitors: number;
  pageViews: number;
}

export interface DailyTrendItem {
  date: string; // YYYY-MM-DD
  label: string; // "26 Okt"
  uniqueVisitors: number;
  pageViews: number;
}

export interface TopPageItem {
  path: string;
  views: number;
  uniqueVisitors: number;
  percentage: number;
}

export interface DeviceBreakdownItem {
  device: string;
  count: number;
  percentage: number;
}

export interface ReferrerItem {
  source: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  today: MetricSummary;
  last7Days: MetricSummary;
  last30Days: MetricSummary;
  allTime: MetricSummary;
  dailyTrend: DailyTrendItem[];
  topPages: TopPageItem[];
  devices: DeviceBreakdownItem[];
  referrers: ReferrerItem[];
  lastUpdated: string;
}

/**
 * Formats a Date into YYYY-MM-DD using Indonesian WIB (Asia/Jakarta) timezone
 */
export function formatWIBDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Calculates full aggregated analytics metrics from a list of SiteVisit items
 */
export function calculateAnalytics(visits: SiteVisit[]): AnalyticsData {
  const now = new Date();
  
  // Current date string in WIB (Asia/Jakarta) e.g. "2026-10-26"
  const todayStr = formatWIBDateString(now);
  const todayStart = new Date(`${todayStr}T00:00:00+07:00`);

  // 7 days ago start
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sevenDaysStr = formatWIBDateString(sevenDaysAgo);
  const sevenDaysStart = new Date(`${sevenDaysStr}T00:00:00+07:00`);

  // 30 days ago start
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const thirtyDaysStr = formatWIBDateString(thirtyDaysAgo);
  const thirtyDaysStart = new Date(`${thirtyDaysStr}T00:00:00+07:00`);

  // Metric accumulators
  const todayVisits: SiteVisit[] = [];
  const last7DaysVisits: SiteVisit[] = [];
  const last30DaysVisits: SiteVisit[] = [];

  // Grouping maps
  const pageViewsPerDay: Record<string, number> = {};
  const sessionsPerDay: Record<string, Set<string>> = {};
  const pageMap: Record<string, { views: number; sessions: Set<string> }> = {};
  const deviceMap: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  const referrerMap: Record<string, number> = {};

  // Initialize the last 30 days in chronological order
  const dailyDates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatWIBDateString(d);
    if (!pageViewsPerDay[dateStr]) {
      dailyDates.push(dateStr);
      pageViewsPerDay[dateStr] = 0;
      sessionsPerDay[dateStr] = new Set<string>();
    }
  }

  const allSessions = new Set<string>();

  visits.forEach((v) => {
    const vDate = new Date(v.created_at);
    allSessions.add(v.session_id);

    // Filter timeframes
    if (vDate >= todayStart) {
      todayVisits.push(v);
    }
    if (vDate >= sevenDaysStart) {
      last7DaysVisits.push(v);
    }
    if (vDate >= thirtyDaysStart) {
      last30DaysVisits.push(v);
    }

    // Daily trends
    const visitDateStr = formatWIBDateString(vDate);
    if (pageViewsPerDay[visitDateStr] !== undefined) {
      pageViewsPerDay[visitDateStr] += 1;
      sessionsPerDay[visitDateStr].add(v.session_id);
    }

    // Top pages (from last 30 days to keep relevant)
    if (vDate >= thirtyDaysStart) {
      const cleanPath = v.path || "/";
      if (!pageMap[cleanPath]) {
        pageMap[cleanPath] = { views: 0, sessions: new Set() };
      }
      pageMap[cleanPath].views += 1;
      pageMap[cleanPath].sessions.add(v.session_id);

      // Device breakdown
      const dev = (v.device_type || "desktop").toLowerCase();
      const safeDev = dev.includes("mobile") ? "mobile" : dev.includes("tablet") ? "tablet" : "desktop";
      deviceMap[safeDev] = (deviceMap[safeDev] || 0) + 1;

      // Referrer breakdown
      let ref = (v.referrer || "direct").toLowerCase().trim();
      if (!ref || ref === "direct" || ref === "null" || ref === "undefined") {
        ref = "Direct / Langsung";
      } else if (ref.includes("instagram")) {
        ref = "Instagram";
      } else if (ref.includes("tiktok")) {
        ref = "TikTok";
      } else if (ref.includes("google")) {
        ref = "Google";
      } else if (ref.includes("whatsapp")) {
        ref = "WhatsApp";
      } else if (ref.includes("facebook")) {
        ref = "Facebook";
      } else if (ref.includes("shopee")) {
        ref = "Shopee";
      }
      referrerMap[ref] = (referrerMap[ref] || 0) + 1;
    }
  });

  // Calculate unique visitors for each timeframe
  const todayUnique = new Set(todayVisits.map((v) => v.session_id)).size;
  const last7DaysUnique = new Set(last7DaysVisits.map((v) => v.session_id)).size;
  const last30DaysUnique = new Set(last30DaysVisits.map((v) => v.session_id)).size;

  // Format daily trend
  const dailyTrend: DailyTrendItem[] = dailyDates.map((dateStr) => {
    const d = new Date(`${dateStr}T12:00:00+07:00`);
    const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return {
      date: dateStr,
      label,
      uniqueVisitors: sessionsPerDay[dateStr]?.size || 0,
      pageViews: pageViewsPerDay[dateStr] || 0,
    };
  });

  // Format Top Pages
  const total30DaysViews = last30DaysVisits.length || 1;
  const topPages: TopPageItem[] = Object.entries(pageMap)
    .map(([pathKey, val]) => ({
      path: pathKey,
      views: val.views,
      uniqueVisitors: val.sessions.size,
      percentage: Math.round((val.views / total30DaysViews) * 100),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Format Device Breakdown
  const totalDevices = (deviceMap.mobile || 0) + (deviceMap.desktop || 0) + (deviceMap.tablet || 0) || 1;
  const devices: DeviceBreakdownItem[] = [
    {
      device: "Mobile Smartphone",
      count: deviceMap.mobile || 0,
      percentage: Math.round(((deviceMap.mobile || 0) / totalDevices) * 100),
    },
    {
      device: "Desktop / Laptop",
      count: deviceMap.desktop || 0,
      percentage: Math.round(((deviceMap.desktop || 0) / totalDevices) * 100),
    },
    {
      device: "Tablet",
      count: deviceMap.tablet || 0,
      percentage: Math.round(((deviceMap.tablet || 0) / totalDevices) * 100),
    },
  ].filter((d) => d.count > 0 || d.device !== "Tablet");

  // Format Top Referrers
  const referrers: ReferrerItem[] = Object.entries(referrerMap)
    .map(([source, count]) => ({
      source,
      count,
      percentage: Math.round((count / total30DaysViews) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    today: {
      uniqueVisitors: todayUnique,
      pageViews: todayVisits.length,
    },
    last7Days: {
      uniqueVisitors: last7DaysUnique,
      pageViews: last7DaysVisits.length,
    },
    last30Days: {
      uniqueVisitors: last30DaysUnique,
      pageViews: last30DaysVisits.length,
    },
    allTime: {
      uniqueVisitors: allSessions.size,
      pageViews: visits.length,
    },
    dailyTrend,
    topPages,
    devices,
    referrers,
    lastUpdated: new Date().toISOString(),
  };
}
