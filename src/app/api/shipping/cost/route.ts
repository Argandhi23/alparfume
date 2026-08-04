import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

const API_KEY = process.env.RAJAONGKIR_API_KEY || process.env.BINDERBYTE_API_KEY || "";
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

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, 45, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }
    const body = await request.json();
    const { province, city, district, weight, force_fallback } = body || {};
    const sanitizeStr = (val: unknown) => typeof val === "string" ? val.replace(/[^\w\s,.-]/gi, "").trim().slice(0, 100) : "";
    const cleanProvince = sanitizeStr(province);
    const cleanCity = sanitizeStr(city);
    const cleanDistrict = sanitizeStr(district);

    const parsedWeight = typeof weight === "number" && weight > 0 && weight <= 50000 ? weight : 500;
    const weightKg = Math.max(1, Math.ceil(parsedWeight / 1000));

    const isDev = process.env.NODE_ENV === "development";
    const secretTestKey = process.env.SHIPPING_TEST_SECRET;
    const headerTestKey = request.headers.get("x-shipping-test-secret");

    // Protection: force_fallback is strictly disabled in production unless accompanied by an internal secret header
    const isTestingFallback = (isDev && (force_fallback === true || request.headers.get("x-force-fallback") === "true")) ||
      (Boolean(secretTestKey) && headerTestKey === secretTestKey);

    const searchQueries: string[] = [];
    if (cleanDistrict && cleanCity) searchQueries.push(`${cleanDistrict}, ${cleanCity}`);
    if (cleanDistrict) searchQueries.push(cleanDistrict);
    if (cleanCity) searchQueries.push(cleanCity);
    if (cleanProvince) searchQueries.push(cleanProvince);

    let destinationId: number | null = null;
    let matchedDestinationLabel = "";

    if (!API_KEY && !isTestingFallback) {
      console.warn("Shipping Cost API: RAJAONGKIR_API_KEY / BINDERBYTE_API_KEY is missing. Falling back to internal tariff engine.");
    }

    // 1. SEARCH DESTINATION ID VIA KOMERCE API (Skipped if testing fallback or no API_KEY)
    if (API_KEY && !isTestingFallback && searchQueries.length > 0) {
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
              const bestMatch = results.find(d => 
                (district && d.district_name.toLowerCase().includes(district.toLowerCase())) ||
                (city && d.city_name.toLowerCase().includes(city.toLowerCase()))
              ) || results[0];

              destinationId = bestMatch.id;
              matchedDestinationLabel = bestMatch.label;
              break;
            }
          }
        } catch (err) {
          console.warn(`Destination search timeout/error for "${query}":`, err);
        }
      }
    }

    // 2. CALCULATE LIVE COSTS VIA KOMERCE V2 API WITH DYNAMIC WEIGHT
    if (API_KEY && !isTestingFallback && destinationId) {
      try {
        const couriers = ["jne", "jnt", "sicepat", "pos", "anteraja", "ide", "ninja", "lion", "spx"];
        const liveRatesResults = await Promise.all(
          couriers.map(async (courier) => {
            try {
              const formData = new URLSearchParams();
              formData.append("origin", DEFAULT_ORIGIN_ID);
              formData.append("destination", String(destinationId));
              formData.append("weight", String(parsedWeight));
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

    // 3. REALISTIC FALLBACK ENGINE (Multiplied by weightKg)
    const combinedLocation = `${district || ""} ${city || ""} ${province || ""}`.toLowerCase().trim();
    
    // Default Tariff (for completely unrecognized locations)
    let baseTariff = { jnt: 22000, jne: 20000, sicepat: 19000, pos: 18000 };

    // Overlap-safe matching hierarchy (checked from specific/near to broad/remote)
    // RING 1: Gerbangkertosusila & Surabaya Raya (Checked FIRST to avoid "bangkalan" matching "bangka")
    if (
      combinedLocation.includes("surabaya") ||
      combinedLocation.includes("sidoarjo") ||
      combinedLocation.includes("gresik") ||
      combinedLocation.includes("mojokerto") ||
      combinedLocation.includes("lamongan") ||
      combinedLocation.includes("bangkalan") ||
      combinedLocation.includes("pasuruan")
    ) {
      baseTariff = { jnt: 9000, jne: 8000, sicepat: 8000, pos: 7000 };
    }
    // TIER 1: PAPUA & MALUKU
    else if (
      combinedLocation.includes("papua") ||
      combinedLocation.includes("jayapura") ||
      combinedLocation.includes("merauke") ||
      combinedLocation.includes("timika") ||
      combinedLocation.includes("sorong") ||
      combinedLocation.includes("manokwari") ||
      combinedLocation.includes("biak") ||
      combinedLocation.includes("nabire") ||
      combinedLocation.includes("maluku") ||
      combinedLocation.includes("ambon") ||
      combinedLocation.includes("ternate") ||
      combinedLocation.includes("tidore")
    ) {
      baseTariff = { jnt: 120000, jne: 115000, sicepat: 110000, pos: 95000 };
    }
    // TIER 2: SULAWESI, BALI & NUSA TENGGARA
    else if (
      combinedLocation.includes("sulawesi") ||
      combinedLocation.includes("makassar") ||
      combinedLocation.includes("manado") ||
      combinedLocation.includes("palu") ||
      combinedLocation.includes("kendari") ||
      combinedLocation.includes("gorontalo") ||
      combinedLocation.includes("mamuju") ||
      combinedLocation.includes("bali") ||
      combinedLocation.includes("denpasar") ||
      combinedLocation.includes("singaraja") ||
      combinedLocation.includes("ubud") ||
      combinedLocation.includes("ntb") ||
      combinedLocation.includes("ntt") ||
      combinedLocation.includes("mataram") ||
      combinedLocation.includes("kupang") ||
      combinedLocation.includes("labuan bajo") ||
      combinedLocation.includes("bima") ||
      combinedLocation.includes("sumbawa")
    ) {
      baseTariff = { jnt: 35000, jne: 32000, sicepat: 30000, pos: 28000 };
    }
    // TIER 3: KALIMANTAN (Checked before "banjar" in Jabar)
    else if (
      combinedLocation.includes("kalimantan") ||
      combinedLocation.includes("banjarmasin") ||
      combinedLocation.includes("balikpapan") ||
      combinedLocation.includes("samarinda") ||
      combinedLocation.includes("pontianak") ||
      combinedLocation.includes("palangkaraya") ||
      combinedLocation.includes("tarakan") ||
      combinedLocation.includes("banjarbaru") ||
      combinedLocation.includes("singkawang")
    ) {
      baseTariff = { jnt: 42000, jne: 40000, sicepat: 38000, pos: 35000 };
    }
    // TIER 4: SUMATERA & KEP. RIAU / BANGKA BELITUNG (Checked before "solo" & "batu")
    else if (
      combinedLocation.includes("sumatra") ||
      combinedLocation.includes("sumatera") ||
      combinedLocation.includes("medan") ||
      combinedLocation.includes("palembang") ||
      combinedLocation.includes("padang") ||
      combinedLocation.includes("lampung") ||
      combinedLocation.includes("pekanbaru") ||
      combinedLocation.includes("batam") ||
      combinedLocation.includes("bengkulu") ||
      combinedLocation.includes("jambi") ||
      combinedLocation.includes("aceh") ||
      combinedLocation.includes("bangka") ||
      combinedLocation.includes("belitung") ||
      combinedLocation.includes("riau") ||
      combinedLocation.includes("solok") ||
      combinedLocation.includes("batusangkar")
    ) {
      baseTariff = { jnt: 45000, jne: 42000, sicepat: 40000, pos: 38000 };
    }
    // TIER 5: JAWA TENGAH & DI YOGYAKARTA (Checked before Jabar to catch banjarnegara & surakarta properly)
    else if (
      combinedLocation.includes("jawa tengah") ||
      combinedLocation.includes("yogyakarta") ||
      combinedLocation.includes("jogja") ||
      combinedLocation.includes("semarang") ||
      combinedLocation.includes("solo") ||
      combinedLocation.includes("surakarta") ||
      combinedLocation.includes("sleman") ||
      combinedLocation.includes("bantul") ||
      combinedLocation.includes("magelang") ||
      combinedLocation.includes("kudus") ||
      combinedLocation.includes("pati") ||
      combinedLocation.includes("pekalongan") ||
      combinedLocation.includes("tegal") ||
      combinedLocation.includes("purwokerto") ||
      combinedLocation.includes("banyumas") ||
      combinedLocation.includes("cilacap") ||
      combinedLocation.includes("sragen") ||
      combinedLocation.includes("karanganyar") ||
      combinedLocation.includes("boyolali") ||
      combinedLocation.includes("klaten") ||
      combinedLocation.includes("wonogiri") ||
      combinedLocation.includes("demak") ||
      combinedLocation.includes("kendal") ||
      combinedLocation.includes("jepara") ||
      combinedLocation.includes("grobogan") ||
      combinedLocation.includes("blora") ||
      combinedLocation.includes("rembang") ||
      combinedLocation.includes("temanggung") ||
      combinedLocation.includes("wonosobo") ||
      combinedLocation.includes("banjarnegara") ||
      combinedLocation.includes("purbalingga") ||
      combinedLocation.includes("kebumen") ||
      combinedLocation.includes("purworejo") ||
      combinedLocation.includes("brebes")
    ) {
      baseTariff = { jnt: 15000, jne: 13000, sicepat: 12000, pos: 11000 };
    }
    // TIER 6: JABODETABEK, JAWA BARAT & BANTEN
    else if (
      combinedLocation.includes("jakarta") ||
      combinedLocation.includes("bogor") ||
      combinedLocation.includes("depok") ||
      combinedLocation.includes("tangerang") ||
      combinedLocation.includes("bekasi") ||
      combinedLocation.includes("jawa barat") ||
      combinedLocation.includes("banten") ||
      combinedLocation.includes("bandung") ||
      combinedLocation.includes("cimahi") ||
      combinedLocation.includes("cirebon") ||
      combinedLocation.includes("sukabumi") ||
      combinedLocation.includes("tasikmalaya") ||
      combinedLocation.includes("garut") ||
      combinedLocation.includes("purwakarta") ||
      combinedLocation.includes("subang") ||
      combinedLocation.includes("sumedang") ||
      combinedLocation.includes("indramayu") ||
      combinedLocation.includes("majalengka") ||
      combinedLocation.includes("ciamis") ||
      combinedLocation.includes("kuningan") ||
      combinedLocation.includes("cianjur") ||
      combinedLocation.includes("karawang") ||
      combinedLocation.includes("serang") ||
      combinedLocation.includes("cilegon") ||
      combinedLocation.includes("lebak") ||
      combinedLocation.includes("pandeglang") ||
      combinedLocation.includes("kota banjar")
    ) {
      baseTariff = { jnt: 18000, jne: 16000, sicepat: 15000, pos: 14000 };
    }
    // TIER 7: JAWA TIMUR (Luar Gerbangkertosusila)
    else if (
      combinedLocation.includes("jawa timur") ||
      combinedLocation.includes("malang") ||
      combinedLocation.includes("kediri") ||
      combinedLocation.includes("madiun") ||
      combinedLocation.includes("jember") ||
      combinedLocation.includes("banyuwangi") ||
      combinedLocation.includes("tuban") ||
      combinedLocation.includes("probolinggo") ||
      combinedLocation.includes("blitar") ||
      combinedLocation.includes("tulungagung") ||
      combinedLocation.includes("ngawi") ||
      combinedLocation.includes("ponorogo") ||
      combinedLocation.includes("pacitan") ||
      combinedLocation.includes("bondowoso") ||
      combinedLocation.includes("situbondo") ||
      combinedLocation.includes("lumajang") ||
      combinedLocation.includes("nganjuk") ||
      combinedLocation.includes("magetan") ||
      combinedLocation.includes("trenggalek") ||
      combinedLocation.includes("sampang") ||
      combinedLocation.includes("pamekasan") ||
      combinedLocation.includes("sumenep") ||
      combinedLocation.includes("batu")
    ) {
      baseTariff = { jnt: 11000, jne: 10000, sicepat: 9500, pos: 9000 };
    }

    const fallbackRates = [
      { id: "jnt_ez", name: "J&T Express (EZ)", est: "1-2 Hari", cost: baseTariff.jnt * weightKg },
      { id: "jne_reg", name: "JNE Regular (REG)", est: "2-3 Hari", cost: baseTariff.jne * weightKg },
      { id: "sicepat_reg", name: "SiCepat Regular (REG)", est: "2-3 Hari", cost: baseTariff.sicepat * weightKg },
      { id: "pos_kilat", name: "POS Kilat Khusus", est: "3-4 Hari", cost: baseTariff.pos * weightKg },
    ];

    return NextResponse.json({
      success: true,
      is_live_api: false,
      provider: isTestingFallback ? "Internal Engine Fallback (Testing Mode)" : "Internal Engine Fallback",
      weight: parsedWeight,
      weight_kg: weightKg,
      rates: fallbackRates,
    });
  } catch (err) {
    console.error("Shipping API error:", err);
    return NextResponse.json({ success: false, error: "Gagal memuat tarif ongkir" }, { status: 500 });
  }
}
