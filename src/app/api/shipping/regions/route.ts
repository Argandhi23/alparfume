import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

const API_KEY = process.env.RAJAONGKIR_API_KEY || "";
const RAJAONGKIR_BASE = "https://api.rajaongkir.com/starter";

interface EmsifaItem {
  id: string;
  name: string;
}

// Fallback Indonesian Provinces (All 38 Provinces)
const FALLBACK_PROVINCES = [
  { province_id: "11", province: "Aceh", id: "11", name: "Aceh" },
  { province_id: "12", province: "Sumatera Utara", id: "12", name: "Sumatera Utara" },
  { province_id: "13", province: "Sumatera Barat", id: "13", name: "Sumatera Barat" },
  { province_id: "14", province: "Riau", id: "14", name: "Riau" },
  { province_id: "15", province: "Jambi", id: "15", name: "Jambi" },
  { province_id: "16", province: "Sumatera Selatan", id: "16", name: "Sumatera Selatan" },
  { province_id: "17", province: "Bengkulu", id: "17", name: "Bengkulu" },
  { province_id: "18", province: "Lampung", id: "18", name: "Lampung" },
  { province_id: "19", province: "Kepulauan Bangka Belitung", id: "19", name: "Kepulauan Bangka Belitung" },
  { province_id: "21", province: "Kepulauan Riau", id: "21", name: "Kepulauan Riau" },
  { province_id: "31", province: "DKI Jakarta", id: "31", name: "DKI Jakarta" },
  { province_id: "32", province: "Jawa Barat", id: "32", name: "Jawa Barat" },
  { province_id: "33", province: "Jawa Tengah", id: "33", name: "Jawa Tengah" },
  { province_id: "34", province: "DI Yogyakarta", id: "34", name: "DI Yogyakarta" },
  { province_id: "35", province: "Jawa Timur", id: "35", name: "Jawa Timur" },
  { province_id: "36", province: "Banten", id: "36", name: "Banten" },
  { province_id: "51", province: "Bali", id: "51", name: "Bali" },
  { province_id: "52", province: "Nusa Tenggara Barat", id: "52", name: "Nusa Tenggara Barat" },
  { province_id: "53", province: "Nusa Tenggara Timur", id: "53", name: "Nusa Tenggara Timur" },
  { province_id: "61", province: "Kalimantan Barat", id: "61", name: "Kalimantan Barat" },
  { province_id: "62", province: "Kalimantan Tengah", id: "62", name: "Kalimantan Tengah" },
  { province_id: "63", province: "Kalimantan Selatan", id: "63", name: "Kalimantan Selatan" },
  { province_id: "64", province: "Kalimantan Timur", id: "64", name: "Kalimantan Timur" },
  { province_id: "65", province: "Kalimantan Utara", id: "65", name: "Kalimantan Utara" },
  { province_id: "71", province: "Sulawesi Utara", id: "71", name: "Sulawesi Utara" },
  { province_id: "72", province: "Sulawesi Tengah", id: "72", name: "Sulawesi Tengah" },
  { province_id: "73", province: "Sulawesi Selatan", id: "73", name: "Sulawesi Selatan" },
  { province_id: "74", province: "Sulawesi Tenggara", id: "74", name: "Sulawesi Tenggara" },
  { province_id: "75", province: "Gorontalo", id: "75", name: "Gorontalo" },
  { province_id: "76", province: "Sulawesi Barat", id: "76", name: "Sulawesi Barat" },
  { province_id: "81", province: "Maluku", id: "81", name: "Maluku" },
  { province_id: "82", province: "Maluku Utara", id: "82", name: "Maluku Utara" },
  { province_id: "91", province: "Papua Barat", id: "91", name: "Papua Barat" },
  { province_id: "94", province: "Papua", id: "94", name: "Papua" }
];

// Capitalize words nicely (e.g. "KABUPATEN BANDUNG" -> "Kabupaten Bandung")
function capitalizeWords(str: string) {
  return str
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 60, 60 * 1000);
  if (!rateLimit.success) {
    return rateLimit.response!;
  }
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const provinceId = searchParams.get("province_id");
  const provinceName = searchParams.get("province_name");
  const cityId = searchParams.get("city_id");
  const cityName = searchParams.get("city_name");

  try {
    // -------------------------------------------------------------
    // 1. PROVINCES
    // -------------------------------------------------------------
    if (type === "provinces") {
      // Level 1: Try RajaOngkir with strict 2.5s timeout if API_KEY is present
      if (!API_KEY) {
        console.warn("Shipping Regions API: RAJAONGKIR_API_KEY is missing. Skipping RajaOngkir and falling back to EMSIFA/Local Dataset.");
      } else {
        try {
          const res = await fetch(`${RAJAONGKIR_BASE}/province`, {
            headers: { key: API_KEY },
            signal: AbortSignal.timeout(2500),
            next: { revalidate: 86400 }
          });
          if (res.ok) {
            const data = await res.json();
            const results = data?.rajaongkir?.results;
            if (Array.isArray(results) && results.length > 0) {
              const formatted = results.map((p: { province_id: string; province: string }) => ({
                province_id: String(p.province_id),
                province: p.province,
                id: String(p.province_id),
                name: p.province
              }));
              return NextResponse.json(formatted);
            }
          }
        } catch {
          // RajaOngkir failed or timed out, fallback to EMSIFA
        }
      }

      // Level 2: Try EMSIFA API
      try {
        const res = await fetch("https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json", {
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 86400 }
        });
        if (res.ok) {
          const data: EmsifaItem[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const formatted = data.map(p => {
              const formattedName = capitalizeWords(p.name);
              return {
                province_id: p.id,
                province: formattedName,
                id: p.id,
                name: formattedName
              };
            });
            return NextResponse.json(formatted);
          }
        }
      } catch {
        // EMSIFA failed, fallback to local dataset
      }

      // Level 3: Offline Static Fallback
      return NextResponse.json(FALLBACK_PROVINCES);
    }

    // -------------------------------------------------------------
    // 2. CITIES / KABUPATEN
    // -------------------------------------------------------------
    else if (type === "cities" && (provinceId || provinceName)) {
      // Level 1: Try RajaOngkir if provinceId is numeric
      if (provinceId) {
        try {
          const res = await fetch(`${RAJAONGKIR_BASE}/city?province=${provinceId}`, {
            headers: { key: API_KEY },
            signal: AbortSignal.timeout(2500),
            next: { revalidate: 86400 }
          });
          if (res.ok) {
            const data = await res.json();
            const results = data?.rajaongkir?.results;
            if (Array.isArray(results) && results.length > 0) {
              const formatted = results.map((c: { city_id: string; province_id: string; type: string; city_name: string; postal_code?: string }) => ({
                city_id: String(c.city_id),
                province_id: String(c.province_id),
                type: c.type,
                city_name: c.city_name,
                id: String(c.city_id),
                name: `${c.type} ${c.city_name}`,
                postal_code: c.postal_code || ""
              }));
              return NextResponse.json(formatted);
            }
          }
        } catch {
          // RajaOngkir failed or timed out
        }
      }

      // Level 2: Try EMSIFA regencies
      try {
        let targetProvId = provinceId;

        // If targetProvId is not valid for EMSIFA or comes from RajaOngkir, match province by name
        if (!targetProvId || provinceName) {
          const provRes = await fetch("https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json", {
            signal: AbortSignal.timeout(2500),
            next: { revalidate: 86400 }
          });
          if (provRes.ok) {
            const provs: EmsifaItem[] = await provRes.json();
            const matched = provs.find(p => 
              p.id === provinceId || 
              (provinceName && p.name.toLowerCase() === provinceName.toLowerCase()) ||
              (provinceName && capitalizeWords(p.name).toLowerCase() === provinceName.toLowerCase())
            );
            if (matched) targetProvId = matched.id;
          }
        }

        if (targetProvId) {
          const regRes = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${targetProvId}.json`, {
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 86400 }
          });

          if (regRes.ok) {
            const regData: EmsifaItem[] = await regRes.json();
            if (Array.isArray(regData) && regData.length > 0) {
              const formatted = regData.map(c => {
                const isKota = c.name.toUpperCase().startsWith("KOTA ");
                const typeName = isKota ? "Kota" : "Kabupaten";
                const cleanCityName = c.name.replace(/^(KOTA|KABUPATEN)\s+/i, "").trim();
                const formattedCityName = capitalizeWords(cleanCityName);
                
                return {
                  city_id: c.id,
                  province_id: targetProvId,
                  type: typeName,
                  city_name: formattedCityName,
                  id: c.id,
                  name: `${typeName} ${formattedCityName}`,
                };
              });
              return NextResponse.json(formatted);
            }
          }
        }
      } catch {
        // EMSIFA regencies failed
      }

      // Level 3: Basic Fallback Regencies for major provinces
      const sampleCities = [
        { city_id: "1", province_id: provinceId || "35", type: "Kota", city_name: "Surabaya", id: "1", name: "Kota Surabaya" },
        { city_id: "2", province_id: provinceId || "35", type: "Kabupaten", city_name: "Sidoarjo", id: "2", name: "Kabupaten Sidoarjo" },
        { city_id: "3", province_id: provinceId || "35", type: "Kabupaten", city_name: "Gresik", id: "3", name: "Kabupaten Gresik" },
        { city_id: "4", province_id: provinceId || "35", type: "Kota", city_name: "Malang", id: "4", name: "Kota Malang" },
        { city_id: "5", province_id: provinceId || "31", type: "Kota", city_name: "Jakarta Selatan", id: "5", name: "Kota Jakarta Selatan" },
        { city_id: "6", province_id: provinceId || "31", type: "Kota", city_name: "Jakarta Pusat", id: "6", name: "Kota Jakarta Pusat" },
        { city_id: "7", province_id: provinceId || "32", type: "Kota", city_name: "Bandung", id: "7", name: "Kota Bandung" },
        { city_id: "8", province_id: provinceId || "33", type: "Kota", city_name: "Semarang", id: "8", name: "Kota Semarang" }
      ];
      return NextResponse.json(sampleCities);
    }

    // -------------------------------------------------------------
    // 3. SUBDISTRICTS / KECAMATAN
    // -------------------------------------------------------------
    else if (type === "subdistricts") {
      // Level 1: Try Direct EMSIFA District lookup if cityId is an EMSIFA ID
      if (cityId) {
        try {
          const distRes = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`, {
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 86400 }
          });
          if (distRes.ok) {
            const distData: EmsifaItem[] = await distRes.json();
            if (Array.isArray(distData) && distData.length > 0) {
              const formatted = distData.map(d => ({
                id: d.id,
                name: capitalizeWords(d.name)
              }));
              return NextResponse.json(formatted);
            }
          }
        } catch {
          // Direct district lookup failed
        }
      }

      // Level 2: Try EMSIFA matching via provinceName & cityName
      if (provinceName && cityName) {
        try {
          const provRes = await fetch("https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json", {
            signal: AbortSignal.timeout(2500),
            next: { revalidate: 86400 }
          });
          if (provRes.ok) {
            const provData: EmsifaItem[] = await provRes.json();
            const emsifaProv = provData.find(p => p.name.toLowerCase() === provinceName.toLowerCase() || capitalizeWords(p.name).toLowerCase() === provinceName.toLowerCase());
            
            if (emsifaProv) {
              const cityRes = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${emsifaProv.id}.json`, {
                signal: AbortSignal.timeout(2500),
                next: { revalidate: 86400 }
              });
              if (cityRes.ok) {
                const cityData: EmsifaItem[] = await cityRes.json();
                const normalizedQueryCity = cityName.toLowerCase().replace(/^(kota|kabupaten)\s+/i, '').trim();
                const emsifaCity = cityData.find(c => {
                  const normalizedTarget = c.name.toLowerCase().replace(/^(kota|kabupaten)\s+/i, '').trim();
                  return normalizedTarget === normalizedQueryCity;
                });

                if (emsifaCity) {
                  const distRes = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${emsifaCity.id}.json`, {
                    signal: AbortSignal.timeout(2500),
                    next: { revalidate: 86400 }
                  });
                  if (distRes.ok) {
                    const distData: EmsifaItem[] = await distRes.json();
                    const formatted = distData.map(d => ({
                      id: d.id,
                      name: capitalizeWords(d.name)
                    }));
                    return NextResponse.json(formatted);
                  }
                }
              }
            }
          }
        } catch {
          // Name matching failed
        }
      }

      // Level 3: Fallback District Options
      const fallbackKecamatan = [
        { id: "k1", name: "Kecamatan Pusat" },
        { id: "k2", name: "Kecamatan Utara" },
        { id: "k3", name: "Kecamatan Selatan" },
        { id: "k4", name: "Kecamatan Barat" },
        { id: "k5", name: "Kecamatan Timur" }
      ];
      return NextResponse.json(fallbackKecamatan);
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error) {
    console.error("Regions API Graceful Error:", error);
    // Even in error state, return fallback provinces to never break the UI
    if (type === "provinces") {
      return NextResponse.json(FALLBACK_PROVINCES);
    }
    return NextResponse.json([]);
  }
}
