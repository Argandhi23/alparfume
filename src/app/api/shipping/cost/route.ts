import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { calculateFallbackShippingRates, CalculatedCourierRate } from "@/lib/shippingTariff";

const API_KEY = process.env.RAJAONGKIR_API_KEY || process.env.BINDERBYTE_API_KEY || "";
const KOMERCE_BASE = "https://rajaongkir.komerce.id/api/v1";

// Alparfume Default Origin: Taman, Madiun City (Komerce Destination ID: 39901)
const DEFAULT_ORIGIN_ID = process.env.RAJAONGKIR_ORIGIN_ID || "39901";

interface KomerceCostItem {
  name: string;
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

interface KomerceDestination {
  id: number;
  label: string;
  province_name: string;
  city_name: string;
  district_name: string;
  subdistrict_name: string;
  zip_code: string;
}

// ============================================================================
// IN-MEMORY CACHE & CIRCUIT BREAKER TO PROTECT KOMERCE API FREE QUOTA
// ============================================================================
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours
const MAX_CACHE_ENTRIES = 500;

const destinationCache = new Map<string, { id: number; label: string; expiresAt: number }>();
const ratesCache = new Map<string, { rates: CalculatedCourierRate[]; destination: string; expiresAt: number }>();

let quotaExhaustedUntil = 0;

function pruneMapIfNeeded<K, V>(map: Map<K, V>) {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) {
      map.delete(firstKey);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, 45, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }
    const body = await request.json();
    const { province, city, district, weight, force_fallback } = body || {};
    const sanitizeStr = (val: unknown) =>
      typeof val === "string" ? val.replace(/[^\w\s,.-]/gi, "").trim().slice(0, 100) : "";
    const cleanProvince = sanitizeStr(province);
    const cleanCity = sanitizeStr(city);
    const cleanDistrict = sanitizeStr(district);

    const parsedWeight = typeof weight === "number" && weight > 0 && weight <= 50000 ? weight : 1000;
    const weightKg = Math.max(1, Math.ceil(parsedWeight / 1000));

    const isDev = process.env.NODE_ENV === "development";
    const secretTestKey = process.env.SHIPPING_TEST_SECRET;
    const headerTestKey = request.headers.get("x-shipping-test-secret");

    // Protection: force_fallback is strictly disabled in production unless accompanied by an internal secret header
    const isTestingFallback =
      (isDev && (force_fallback === true || request.headers.get("x-force-fallback") === "true")) ||
      (Boolean(secretTestKey) && headerTestKey === secretTestKey);

    const now = Date.now();
    const isQuotaCircuitOpen = now < quotaExhaustedUntil;

    const locationCacheKey = `${cleanProvince}|${cleanCity}|${cleanDistrict}`.toLowerCase();
    const ratesCacheKey = `${locationCacheKey}|${weightKg}`;

    // 0. Check In-Memory Rates Cache First (0 API Calls Used!)
    if (!isTestingFallback) {
      const cachedRateEntry = ratesCache.get(ratesCacheKey);
      if (cachedRateEntry && cachedRateEntry.expiresAt > now) {
        return NextResponse.json({
          success: true,
          is_live_api: true,
          cached: true,
          provider: "RajaOngkir Komerce V2 (Cached)",
          destination: cachedRateEntry.destination,
          weight: parsedWeight,
          weight_kg: weightKg,
          rates: cachedRateEntry.rates,
        });
      }
    }

    const searchQueries: string[] = [];
    if (cleanDistrict && cleanCity) searchQueries.push(`${cleanDistrict}, ${cleanCity}`);
    if (cleanDistrict) searchQueries.push(cleanDistrict);
    if (cleanCity) searchQueries.push(cleanCity);
    if (cleanProvince) searchQueries.push(cleanProvince);

    let destinationId: number | null = null;
    let matchedDestinationLabel = "";

    // Check Destination Cache
    const cachedDest = destinationCache.get(locationCacheKey);
    if (cachedDest && cachedDest.expiresAt > now) {
      destinationId = cachedDest.id;
      matchedDestinationLabel = cachedDest.label;
    }

    // 1. SEARCH DESTINATION ID VIA KOMERCE API (Skipped if cached, testing fallback, quota exhausted, or no API_KEY)
    if (!destinationId && API_KEY && !isTestingFallback && !isQuotaCircuitOpen && searchQueries.length > 0) {
      for (const query of searchQueries) {
        try {
          const searchRes = await fetch(
            `${KOMERCE_BASE}/destination/domestic-destination?search=${encodeURIComponent(query)}`,
            {
              headers: { key: API_KEY },
              signal: AbortSignal.timeout(3000),
              next: { revalidate: 86400 },
            }
          );

          if (searchRes.status === 429 || searchRes.status === 402 || searchRes.status === 403) {
            console.warn(`Komerce API quota/rate limit reached (HTTP ${searchRes.status}). Activating fallback circuit breaker for 10m.`);
            quotaExhaustedUntil = Date.now() + 10 * 60 * 1000;
            break;
          }

          if (searchRes.ok) {
            const json = await searchRes.json();
            const results: KomerceDestination[] = json?.data;
            if (Array.isArray(results) && results.length > 0) {
              const bestMatch =
                results.find(
                  (d) =>
                    (cleanDistrict && d.district_name.toLowerCase().includes(cleanDistrict.toLowerCase())) ||
                    (cleanCity && d.city_name.toLowerCase().includes(cleanCity.toLowerCase()))
                ) || results[0];

              destinationId = bestMatch.id;
              matchedDestinationLabel = bestMatch.label;

              pruneMapIfNeeded(destinationCache);
              destinationCache.set(locationCacheKey, {
                id: destinationId,
                label: matchedDestinationLabel,
                expiresAt: Date.now() + CACHE_TTL_MS,
              });
              break;
            }
          }
        } catch (err) {
          console.warn(`Destination search timeout/error for "${query}":`, err);
        }
      }
    }

    // 2. CALCULATE LIVE COSTS VIA KOMERCE V2 API WITH DYNAMIC WEIGHT
    if (API_KEY && !isTestingFallback && !isQuotaCircuitOpen && destinationId) {
      try {
        // Query only the 5 core couriers used by Al Parfume to save 45% Komerce API quota per lookup
        const couriers = ["jnt", "jne", "sicepat", "pos", "ide"];
        const liveRatesResults = await Promise.all(
          couriers.map(async (courier) => {
            if (Date.now() < quotaExhaustedUntil) return [];
            try {
              const formData = new URLSearchParams();
              formData.append("origin", DEFAULT_ORIGIN_ID);
              formData.append("destination", String(destinationId));
              formData.append("weight", String(parsedWeight));
              formData.append("courier", courier);

              const res = await fetch(`${KOMERCE_BASE}/calculate/domestic-cost`, {
                method: "POST",
                headers: {
                  key: API_KEY,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData.toString(),
                signal: AbortSignal.timeout(3500),
                next: { revalidate: 43200 }, // Cache identical POST in Next.js Data Cache for 12 hours
              });

              if (res.status === 429 || res.status === 402 || res.status === 403) {
                quotaExhaustedUntil = Date.now() + 10 * 60 * 1000;
                return [];
              }

              if (res.ok) {
                const data = await res.json();
                const items: KomerceCostItem[] = data?.data;

                if (Array.isArray(items) && items.length > 0) {
                  const validServices = items.filter(
                    (i) =>
                      i.cost > 0 &&
                      !i.service.includes(">130") &&
                      !i.service.includes(">200") &&
                      !i.service.includes("<130")
                  );

                  return validServices.map((i) => {
                    let formattedEtd = i.etd ? i.etd.trim() : "2-3 Hari";
                    if (/^\d+(-\d+)?$/.test(formattedEtd)) {
                      formattedEtd += " Hari";
                    } else if (formattedEtd.endsWith("day")) {
                      formattedEtd = formattedEtd.replace("day", "Hari");
                    }

                    return {
                      id: `${i.code}_${i.service}`.toLowerCase().replace(/\s+/g, "_"),
                      name: `${i.name} (${i.service})`,
                      est: formattedEtd,
                      cost: i.cost,
                    };
                  });
                }
              }
            } catch (err) {
              console.warn(`Komerce cost API error for courier ${courier}:`, err);
            }
            return [];
          })
        );

        const flattenedRates = liveRatesResults.flat();

        if (flattenedRates.length > 0) {
          flattenedRates.sort((a, b) => {
            if (a.id.includes("jnt") || a.name.toLowerCase().includes("j&t")) return -1;
            if (b.id.includes("jnt") || b.name.toLowerCase().includes("j&t")) return 1;
            return a.cost - b.cost;
          });

          const finalRates = flattenedRates.slice(0, 4);

          pruneMapIfNeeded(ratesCache);
          ratesCache.set(ratesCacheKey, {
            rates: finalRates,
            destination: matchedDestinationLabel,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });

          return NextResponse.json({
            success: true,
            is_live_api: true,
            provider: "RajaOngkir Komerce V2",
            destination: matchedDestinationLabel,
            weight: parsedWeight,
            weight_kg: weightKg,
            rates: finalRates,
          });
        }
      } catch (err) {
        console.error("Komerce live API calculation error:", err);
      }
    }

    // 3. REALISTIC FALLBACK ENGINE (Covers all 38 Provinces, multiplied by weightKg)
    const fallbackRates = calculateFallbackShippingRates(
      cleanProvince,
      cleanCity,
      cleanDistrict,
      weightKg
    );

    return NextResponse.json({
      success: true,
      is_live_api: false,
      provider: isTestingFallback
        ? "Internal Engine Fallback (Testing Mode)"
        : "Internal Engine Fallback",
      weight: parsedWeight,
      weight_kg: weightKg,
      rates: fallbackRates,
    });
  } catch (err) {
    console.error("Shipping API error:", err);
    return NextResponse.json({ success: false, error: "Gagal memuat tarif ongkir" }, { status: 500 });
  }
}
