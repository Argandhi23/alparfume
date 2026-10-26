/**
 * Shared Shipping Tariff & Regional Floor Validation Engine
 * Origin: Kec. Taman, Kota Madiun, Jawa Timur (Komerce ID: 39901)
 *
 * Used by:
 * 1. /api/shipping/cost (when Komerce live API is at quota limit / timeout)
 * 2. /api/orders/create (Zero-Trust server-side shipping cost validation so Al Parfume never undercharges)
 */

export interface BaseRegionalTariff {
  tierName: string;
  jnt: number;
  jne: number;
  sicepat: number;
  pos: number;
  minAllowedPerKg: number;
}

export interface CalculatedCourierRate {
  id: string;
  name: string;
  est: string;
  cost: number;
}

export const STORE_PICKUP_INFO = {
  name: "Store AL Parfume Madiun",
  shortAddress: "Dekat Jl. Mego Manis II No.10, Manisrejo, Kec. Taman, Kota Madiun, Jawa Timur 63138",
  hours: "Buka Setiap Hari 09.00 - 21.00 WIB",
  mapsQuery: "Jl. Mego Manis II No.10, Manisrejo, Kec. Taman, Kota Madiun, Jawa Timur 63138",
};

/**
 * Resolves the per-kg base tariff from Madiun for any Indonesian address/region string.
 * Covers all 38 Indonesian provinces and major regencies/cities.
 */
export function resolveRegionalBaseTariff(locationText: string): BaseRegionalTariff {
  const loc = (locationText || "").toLowerCase().trim();

  // RING 1: Karesidenan Madiun (Kota/Kab Madiun, Magetan, Ponorogo, Ngawi)
  if (
    loc.includes("madiun") ||
    loc.includes("magetan") ||
    loc.includes("ponorogo") ||
    loc.includes("ngawi")
  ) {
    return {
      tierName: "Ring 1 - Karesidenan Madiun",
      jnt: 9000,
      jne: 8000,
      sicepat: 8000,
      pos: 7000,
      minAllowedPerKg: 6000,
    };
  }

  // TIER 1: PAPUA (Semua 6 Provinsi) & MALUKU (Maluku & Maluku Utara)
  if (
    loc.includes("papua") ||
    loc.includes("jayapura") ||
    loc.includes("merauke") ||
    loc.includes("timika") ||
    loc.includes("mimika") ||
    loc.includes("sorong") ||
    loc.includes("manokwari") ||
    loc.includes("biak") ||
    loc.includes("nabire") ||
    loc.includes("wamena") ||
    loc.includes("jayawijaya") ||
    loc.includes("fakfak") ||
    loc.includes("kaimana") ||
    loc.includes("maluku") ||
    loc.includes("ambon") ||
    loc.includes("ternate") ||
    loc.includes("tidore") ||
    loc.includes("halmahera") ||
    loc.includes("tual") ||
    loc.includes("masohi") ||
    loc.includes("saumlaki")
  ) {
    return {
      tierName: "Tier 1 - Papua & Maluku",
      jnt: 120000,
      jne: 115000,
      sicepat: 110000,
      pos: 95000,
      minAllowedPerKg: 70000,
    };
  }

  // TIER 2: SULAWESI (Semua 6 Provinsi), BALI, & NUSA TENGGARA (NTB & NTT)
  if (
    loc.includes("sulawesi") ||
    loc.includes("makassar") ||
    loc.includes("manado") ||
    loc.includes("palu") ||
    loc.includes("kendari") ||
    loc.includes("gorontalo") ||
    loc.includes("mamuju") ||
    loc.includes("parepare") ||
    loc.includes("palopo") ||
    loc.includes("bitung") ||
    loc.includes("tomohon") ||
    loc.includes("kotamobagu") ||
    loc.includes("baubau") ||
    loc.includes("bali") ||
    loc.includes("denpasar") ||
    loc.includes("badung") ||
    loc.includes("gianyar") ||
    loc.includes("tabanan") ||
    loc.includes("buleleng") ||
    loc.includes("singaraja") ||
    loc.includes("ubud") ||
    loc.includes("nusa tenggara") ||
    loc.includes("ntb") ||
    loc.includes("ntt") ||
    loc.includes("lombok") ||
    loc.includes("mataram") ||
    loc.includes("kupang") ||
    loc.includes("labuan bajo") ||
    loc.includes("manggarai") ||
    loc.includes("flores") ||
    loc.includes("sumba") ||
    loc.includes("bima") ||
    loc.includes("dompu") ||
    loc.includes("sumbawa")
  ) {
    return {
      tierName: "Tier 2 - Sulawesi, Bali, NTB & NTT",
      jnt: 36000,
      jne: 34000,
      sicepat: 32000,
      pos: 30000,
      minAllowedPerKg: 20000,
    };
  }

  // TIER 3: KALIMANTAN (Semua 5 Provinsi)
  if (
    loc.includes("kalimantan") ||
    loc.includes("banjarmasin") ||
    loc.includes("balikpapan") ||
    loc.includes("samarinda") ||
    loc.includes("pontianak") ||
    loc.includes("palangkaraya") ||
    loc.includes("palangka raya") ||
    loc.includes("tarakan") ||
    loc.includes("banjarbaru") ||
    loc.includes("singkawang") ||
    loc.includes("bontang") ||
    loc.includes("kutai") ||
    loc.includes("berau") ||
    loc.includes("sampit") ||
    loc.includes("pangkalan bun") ||
    loc.includes("ketapang") ||
    loc.includes("sintang") ||
    loc.includes("nunukan") ||
    loc.includes("bulungan")
  ) {
    return {
      tierName: "Tier 3 - Kalimantan",
      jnt: 42000,
      jne: 40000,
      sicepat: 38000,
      pos: 35000,
      minAllowedPerKg: 24000,
    };
  }

  // TIER 4: SUMATERA (Semua 10 Provinsi termasuk Kep. Riau, Bangka Belitung, Aceh, Lampung)
  if (
    loc.includes("sumatra") ||
    loc.includes("sumatera") ||
    loc.includes("aceh") ||
    loc.includes("lhokseumawe") ||
    loc.includes("langsa") ||
    loc.includes("sabang") ||
    loc.includes("medan") ||
    loc.includes("binjai") ||
    loc.includes("pematangsiantar") ||
    loc.includes("tebing tinggi") ||
    loc.includes("deli serdang") ||
    loc.includes("padang") ||
    loc.includes("bukittinggi") ||
    loc.includes("payakumbuh") ||
    loc.includes("solok") ||
    loc.includes("batusangkar") ||
    loc.includes("pekanbaru") ||
    loc.includes("dumai") ||
    loc.includes("riau") ||
    loc.includes("batam") ||
    loc.includes("tanjungpinang") ||
    loc.includes("tanjung pinang") ||
    loc.includes("karimun") ||
    loc.includes("bintan") ||
    loc.includes("natuna") ||
    loc.includes("jambi") ||
    loc.includes("sungai penuh") ||
    loc.includes("palembang") ||
    loc.includes("prabumulih") ||
    loc.includes("lubuklinggau") ||
    loc.includes("pagar alam") ||
    loc.includes("bengkulu") ||
    loc.includes("lampung") ||
    loc.includes("metro") ||
    loc.includes("bangka") ||
    loc.includes("belitung") ||
    loc.includes("pangkalpinang") ||
    loc.includes("pangkal pinang")
  ) {
    return {
      tierName: "Tier 4 - Sumatera & Kepulauan",
      jnt: 45000,
      jne: 42000,
      sicepat: 40000,
      pos: 38000,
      minAllowedPerKg: 22000,
    };
  }

  // TIER 5: JAWA TENGAH & DI YOGYAKARTA
  if (
    loc.includes("jawa tengah") ||
    loc.includes("yogyakarta") ||
    loc.includes("jogja") ||
    loc.includes("semarang") ||
    loc.includes("salatiga") ||
    loc.includes("solo") ||
    loc.includes("surakarta") ||
    loc.includes("sleman") ||
    loc.includes("bantul") ||
    loc.includes("kulon progo") ||
    loc.includes("gunungkidul") ||
    loc.includes("gunung kidul") ||
    loc.includes("magelang") ||
    loc.includes("kudus") ||
    loc.includes("pati") ||
    loc.includes("pekalongan") ||
    loc.includes("batang") ||
    loc.includes("pemalang") ||
    loc.includes("tegal") ||
    loc.includes("brebes") ||
    loc.includes("purwokerto") ||
    loc.includes("banyumas") ||
    loc.includes("cilacap") ||
    loc.includes("sragen") ||
    loc.includes("karanganyar") ||
    loc.includes("boyolali") ||
    loc.includes("klaten") ||
    loc.includes("sukoharjo") ||
    loc.includes("wonogiri") ||
    loc.includes("demak") ||
    loc.includes("kendal") ||
    loc.includes("jepara") ||
    loc.includes("grobogan") ||
    loc.includes("blora") ||
    loc.includes("rembang") ||
    loc.includes("temanggung") ||
    loc.includes("wonosobo") ||
    loc.includes("banjarnegara") ||
    loc.includes("purbalingga") ||
    loc.includes("kebumen") ||
    loc.includes("purworejo")
  ) {
    return {
      tierName: "Tier 5 - Jawa Tengah & DIY",
      jnt: 15000,
      jne: 13000,
      sicepat: 12000,
      pos: 11000,
      minAllowedPerKg: 8000,
    };
  }

  // TIER 6: JABODETABEK, JAWA BARAT & BANTEN
  if (
    loc.includes("jakarta") ||
    loc.includes("bogor") ||
    loc.includes("depok") ||
    loc.includes("tangerang") ||
    loc.includes("bekasi") ||
    loc.includes("jawa barat") ||
    loc.includes("banten") ||
    loc.includes("bandung") ||
    loc.includes("cimahi") ||
    loc.includes("cirebon") ||
    loc.includes("sukabumi") ||
    loc.includes("tasikmalaya") ||
    loc.includes("garut") ||
    loc.includes("purwakarta") ||
    loc.includes("subang") ||
    loc.includes("sumedang") ||
    loc.includes("indramayu") ||
    loc.includes("majalengka") ||
    loc.includes("ciamis") ||
    loc.includes("pangandaran") ||
    loc.includes("kuningan") ||
    loc.includes("cianjur") ||
    loc.includes("karawang") ||
    loc.includes("serang") ||
    loc.includes("cilegon") ||
    loc.includes("lebak") ||
    loc.includes("pandeglang") ||
    loc.includes("kota banjar")
  ) {
    return {
      tierName: "Tier 6 - Jabodetabek, Jabar & Banten",
      jnt: 18000,
      jne: 16000,
      sicepat: 15000,
      pos: 14000,
      minAllowedPerKg: 10000,
    };
  }

  // TIER 7: JAWA TIMUR (Luar Karesidenan Madiun)
  if (
    loc.includes("jawa timur") ||
    loc.includes("surabaya") ||
    loc.includes("sidoarjo") ||
    loc.includes("gresik") ||
    loc.includes("mojokerto") ||
    loc.includes("jombang") ||
    loc.includes("lamongan") ||
    loc.includes("bojonegoro") ||
    loc.includes("tuban") ||
    loc.includes("bangkalan") ||
    loc.includes("sampang") ||
    loc.includes("pamekasan") ||
    loc.includes("sumenep") ||
    loc.includes("madura") ||
    loc.includes("pasuruan") ||
    loc.includes("probolinggo") ||
    loc.includes("malang") ||
    loc.includes("batu") ||
    loc.includes("kediri") ||
    loc.includes("blitar") ||
    loc.includes("tulungagung") ||
    loc.includes("trenggalek") ||
    loc.includes("nganjuk") ||
    loc.includes("jember") ||
    loc.includes("banyuwangi") ||
    loc.includes("bondowoso") ||
    loc.includes("situbondo") ||
    loc.includes("lumajang") ||
    loc.includes("pacitan")
  ) {
    return {
      tierName: "Tier 7 - Jawa Timur",
      jnt: 12000,
      jne: 10000,
      sicepat: 10000,
      pos: 9000,
      minAllowedPerKg: 7000,
    };
  }

  // DEFAULT SAFE BUFFER (Unrecognized location)
  return {
    tierName: "Default Nasional",
    jnt: 24000,
    jne: 22000,
    sicepat: 20000,
    pos: 19000,
    minAllowedPerKg: 10000,
  };
}

/**
 * Generates realistic fallback courier rates multiplied by weightKg.
 */
export function calculateFallbackShippingRates(
  province: string,
  city: string,
  district: string,
  weightKg: number
): CalculatedCourierRate[] {
  const safeWeightKg = Math.max(1, Math.ceil(Number(weightKg) || 1));
  const combinedLocation = `${district || ""} ${city || ""} ${province || ""}`.trim();
  const base = resolveRegionalBaseTariff(combinedLocation);

  return [
    { id: "jnt_ez", name: "J&T Express (EZ)", est: "1-3 Hari", cost: base.jnt * safeWeightKg },
    { id: "jne_reg", name: "JNE Regular (REG)", est: "2-3 Hari", cost: base.jne * safeWeightKg },
    { id: "sicepat_reg", name: "SiCepat Regular (REG)", est: "2-3 Hari", cost: base.sicepat * safeWeightKg },
    { id: "pos_kilat", name: "POS Kilat Khusus", est: "3-5 Hari", cost: base.pos * safeWeightKg },
  ];
}

/**
 * Server-side validation helper for /api/orders/create.
 * Ensures a client-submitted courier shipping cost is never manipulated below the safe regional minimum
 * (e.g., sending Rp 0 or Rp 12.000 for an order to Papua/Sumatera/Kalimantan).
 */
export function validateServerCourierCost(
  requestedShippingCost: number,
  customerAddress: string,
  weightKg: number
): number {
  const safeWeightKg = Math.max(1, Math.ceil(Number(weightKg) || 1));
  const tariff = resolveRegionalBaseTariff(customerAddress);
  const minimumSafeCost = tariff.minAllowedPerKg * safeWeightKg;
  const fallbackStandardCost = tariff.jne * safeWeightKg;

  const parsedCost = Number(requestedShippingCost);
  if (isNaN(parsedCost) || parsedCost < minimumSafeCost) {
    return fallbackStandardCost;
  }

  return Math.floor(parsedCost);
}
