import { NextResponse } from "next/server";

const API_KEY = process.env.RAJAONGKIR_API_KEY || process.env.BINDERBYTE_API_KEY || "aHnSiM306e29d93e911fb214zsbMcmun";
const KOMERCE_BASE = "https://rajaongkir.komerce.id/api/v1";

// Alparfume Default Origin: Genteng, Surabaya City (Komerce Destination ID: 69237)
const DEFAULT_ORIGIN_ID = process.env.RAJAONGKIR_ORIGIN_ID || "69237";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { province, city, district, cityId, weight = 500 } = body;

    const searchQueries: string[] = [];
    if (district && city) searchQueries.push(`${district}, ${city}`);
    if (district) searchQueries.push(district);
    if (city) searchQueries.push(city);
    if (province) searchQueries.push(province);

    let destinationId: number | null = null;
    let matchedDestinationLabel = "";

    // 1. SEARCH DESTINATION ID VIA KOMERCE API
    if (API_KEY && searchQueries.length > 0) {
      for (const query of searchQueries) {
        try {
          const searchRes = await fetch(`${KOMERCE_BASE}/destination/domestic-destination?search=${encodeURIComponent(query)}`, {
            headers: { key: API_KEY },
            signal: AbortSignal.timeout(3000),
            next: { revalidate: 86400 }
          });

          if (searchRes.ok) {
            const json = await searchRes.json();
            const results: KomerceDestination[] = json?.data;
            if (Array.isArray(results) && results.length > 0) {
              // Try to find best match containing city or district
              const bestMatch = results.find(d => 
                (district && d.district_name.toLowerCase().includes(district.toLowerCase())) ||
                (city && d.city_name.toLowerCase().includes(city.toLowerCase()))
              ) || results[0];

              destinationId = bestMatch.id;
              matchedDestinationLabel = bestMatch.label;
              break; // Found destination!
            }
          }
        } catch (err) {
          console.warn(`Destination search timeout/error for "${query}":`, err);
        }
      }
    }

    // 2. CALCULATE LIVE COSTS VIA KOMERCE V2 API
    if (API_KEY && destinationId) {
      try {
        const couriers = ["jne", "jnt", "sicepat", "pos"];
        const liveRatesResults = await Promise.all(
          couriers.map(async (courier) => {
            try {
              const formData = new URLSearchParams();
              formData.append("origin", DEFAULT_ORIGIN_ID);
              formData.append("destination", String(destinationId));
              formData.append("weight", String(weight));
              formData.append("courier", courier);

              const res = await fetch(`${KOMERCE_BASE}/calculate/domestic-cost`, {
                method: "POST",
                headers: {
                  "key": API_KEY,
                  "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData.toString(),
                signal: AbortSignal.timeout(3500),
                next: { revalidate: 0 }
              });

              if (res.ok) {
                const data = await res.json();
                const items: KomerceCostItem[] = data?.data;

                if (Array.isArray(items) && items.length > 0) {
                  // Filter out oversized trucking / heavy cargo codes unless standard
                  const validServices = items.filter(i => 
                    i.cost > 0 && 
                    !i.service.includes(">130") && 
                    !i.service.includes(">200") && 
                    !i.service.includes("<130")
                  );

                  return validServices.map(i => {
                    let formattedEtd = i.etd ? i.etd.trim() : "2-3 Hari";
                    if (/^\d+(-\d+)?$/.test(formattedEtd)) {
                      formattedEtd += " Hari";
                    } else if (formattedEtd.endsWith("day")) {
                      formattedEtd = formattedEtd.replace("day", "Hari");
                    }

                    return {
                      id: `${i.code}_${i.service}`.toLowerCase(),
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
          // Sort rates from cheapest to highest
          flattenedRates.sort((a, b) => a.cost - b.cost);

          // Select top rates (up to 6 distinct options)
          const finalRates = flattenedRates.slice(0, 6);

          console.log(`[RAJAONGKIR KOMERCE V2 SUCCESS] Fetched ${finalRates.length} rates for ${matchedDestinationLabel}`);

          return NextResponse.json({
            success: true,
            is_live_api: true,
            provider: "RajaOngkir Komerce V2",
            destination: matchedDestinationLabel,
            rates: finalRates,
          });
        }
      } catch (err) {
        console.error("Komerce live API calculation error:", err);
      }
    }

    // 3. REALISTIC FALLBACK ENGINE (If API Key quota limit reached or network offline)
    const combinedLocation = `${district || ""} ${city || ""} ${province || ""}`.toLowerCase().trim();
    
    let matchedTariff = { jne: 12000, jnt: 14000, sicepat: 11000, pos: 10000 };

    if (combinedLocation.includes("papua") || combinedLocation.includes("jayapura") || combinedLocation.includes("merauke")) {
      matchedTariff = { jne: 156000, jnt: 160000, sicepat: 145000, pos: 135000 };
    } else if (combinedLocation.includes("maluku") || combinedLocation.includes("ambon") || combinedLocation.includes("ternate")) {
      matchedTariff = { jne: 85000, jnt: 90000, sicepat: 80000, pos: 75000 };
    } else if (combinedLocation.includes("sulawesi") || combinedLocation.includes("makassar") || combinedLocation.includes("manado") || combinedLocation.includes("palu")) {
      matchedTariff = { jne: 52000, jnt: 46000, sicepat: 53000, pos: 49000 };
    } else if (combinedLocation.includes("sumatra") || combinedLocation.includes("sumatera") || combinedLocation.includes("medan") || combinedLocation.includes("palembang") || combinedLocation.includes("padang") || combinedLocation.includes("lampung")) {
      matchedTariff = { jne: 57000, jnt: 45000, sicepat: 43000, pos: 45000 };
    } else if (combinedLocation.includes("kalimantan") || combinedLocation.includes("pontianak") || combinedLocation.includes("banjarmasin") || combinedLocation.includes("balikpapan")) {
      matchedTariff = { jne: 48000, jnt: 50000, sicepat: 45000, pos: 42000 };
    } else if (combinedLocation.includes("ntb") || combinedLocation.includes("ntt") || combinedLocation.includes("bali") || combinedLocation.includes("denpasar") || combinedLocation.includes("mataram")) {
      matchedTariff = { jne: 28000, jnt: 32000, sicepat: 27000, pos: 25000 };
    } else if (combinedLocation.includes("jakarta") || combinedLocation.includes("bogor") || combinedLocation.includes("depok") || combinedLocation.includes("tangerang") || combinedLocation.includes("bekasi")) {
      matchedTariff = { jne: 11000, jnt: 13000, sicepat: 10000, pos: 10000 };
    } else if (combinedLocation.includes("surabaya") || combinedLocation.includes("sidoarjo") || combinedLocation.includes("gresik")) {
      matchedTariff = { jne: 8000, jnt: 9000, sicepat: 8000, pos: 7000 };
    }

    const fallbackRates = [
      { id: "jne_reg", name: "JNE Regular", est: "2-3 Hari", cost: matchedTariff.jne },
      { id: "jnt_ez", name: "J&T Express", est: "1-2 Hari", cost: matchedTariff.jnt },
      { id: "sicepat_reg", name: "SiCepat REG", est: "2-3 Hari", cost: matchedTariff.sicepat },
      { id: "pos_reg", name: "POS Kilat Khusus", est: "3-4 Hari", cost: matchedTariff.pos },
    ];

    return NextResponse.json({
      success: true,
      is_live_api: false,
      provider: "Internal Engine Fallback",
      rates: fallbackRates,
    });
  } catch (err) {
    console.error("Shipping API error:", err);
    return NextResponse.json({ success: false, error: "Gagal memuat tarif ongkir" }, { status: 500 });
  }
}
