import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, 10, 60 * 1000);
    if (!rateLimit.success) {
      return rateLimit.response!;
    }

    const body = await request.json();
    const { orderId, proofUrl } = body;

    if (!orderId || !proofUrl) {
      return NextResponse.json({ error: "orderId dan proofUrl wajib diisi" }, { status: 400 });
    }

    // Limit base64 image length to ~7MB (~5MB raw image) to prevent DoS memory exhaustion
    if (typeof proofUrl === "string" && proofUrl.length > 7 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file gambar terlalu besar (Maksimal 5MB)" }, { status: 400 });
    }

    // Validate that proofUrl is a valid image data URI or valid image URL to prevent malicious non-image file uploads
    const isBase64Image = typeof proofUrl === "string" && /^data:image\/(jpeg|png|jpg|webp);base64,/i.test(proofUrl);
    const isHttpImageUrl = typeof proofUrl === "string" && /^https?:\/\/.+/i.test(proofUrl);

    if (!isBase64Image && !isHttpImageUrl) {
      return NextResponse.json({ error: "Format file tidak valid. Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan." }, { status: 400 });
    }

    const numericId = parseInt(orderId.toString(), 10);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let targetId: number | null = null;

    // 1. Check direct numeric ID match if within integer range
    if (!isNaN(numericId) && numericId > 0 && numericId <= 2147483647) {
      const { data: existingRow } = await serviceClient
        .from("order_intents")
        .select("id")
        .eq("id", numericId)
        .maybeSingle();

      if (existingRow?.id) {
        targetId = existingRow.id;
      }
    }

    // 2. Search by order_code or items_json match if orderId was string/timestamp
    if (!targetId && orderId) {
      const { data: matchedRows } = await serviceClient
        .from("order_intents")
        .select("id")
        .or(`order_code.eq.${orderId},items_json.ilike.%${orderId}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (matchedRows && matchedRows.length > 0 && matchedRows[0].id) {
        targetId = matchedRows[0].id;
      }
    }

    if (!targetId) {
      return NextResponse.json({ error: `Pesanan #${orderId} tidak ditemukan. Mohon periksa kembali ID Pesanan Anda.` }, { status: 404 });
    }

    // 1. Upload Base64 image to Supabase Storage bucket 'payment-proofs' if bucket exists
    let storagePublicUrl: string | null = null;
    try {
      if (typeof proofUrl === "string" && proofUrl.startsWith("data:image")) {
        const base64Data = proofUrl.split(",")[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, "base64");
          const fileName = `proof_${targetId}_${Date.now()}.jpg`;

          const { data: uploadData, error: uploadErr } = await serviceClient.storage
            .from("payment-proofs")
            .upload(fileName, buffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: urlData } = serviceClient.storage
              .from("payment-proofs")
              .getPublicUrl(fileName);

            if (urlData?.publicUrl) {
              storagePublicUrl = urlData.publicUrl;
            }
          }
        }
      }
    } catch (storageErr) {
      console.warn("Supabase Storage bucket upload notice:", storageErr);
    }

    const finalProofUrlToSave = storagePublicUrl || proofUrl;

    // 2. Fetch target row to update items_json
    const { data: currentOrder } = await serviceClient
      .from("order_intents")
      .select("*")
      .eq("id", targetId)
      .single();

    let updatedItemsJson = "";
    if (currentOrder?.items_json) {
      try {
        let parsed = typeof currentOrder.items_json === "string" ? JSON.parse(currentOrder.items_json) : currentOrder.items_json;
        if (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          parsed.payment_proof_url = finalProofUrlToSave;
          parsed.paymentProofUrl = finalProofUrlToSave;
          parsed.payment_status = "pending_verification";
          updatedItemsJson = JSON.stringify(parsed);
        } else {
          updatedItemsJson = JSON.stringify({
            items: parsed,
            payment_proof_url: finalProofUrlToSave,
            paymentProofUrl: finalProofUrlToSave,
            payment_status: "pending_verification",
          });
        }
      } catch {
        updatedItemsJson = JSON.stringify({
          payment_proof_url: finalProofUrlToSave,
          paymentProofUrl: finalProofUrlToSave,
          payment_status: "pending_verification",
        });
      }
    } else {
      updatedItemsJson = JSON.stringify({
        payment_proof_url: finalProofUrlToSave,
        paymentProofUrl: finalProofUrlToSave,
        payment_status: "pending_verification",
      });
    }

    // 3. Update order_intents row in DB
    const { error: fullErr } = await serviceClient
      .from("order_intents")
      .update({
        payment_proof_url: finalProofUrlToSave,
        payment_status: "pending_verification",
        items_json: updatedItemsJson,
      })
      .eq("id", targetId);

    if (fullErr) {
      console.warn("Full column update notice, applying guaranteed items_json update:", fullErr);
      const { error: fallbackErr } = await serviceClient
        .from("order_intents")
        .update({
          items_json: updatedItemsJson,
        })
        .eq("id", targetId);

      if (fallbackErr) {
        console.error("Guaranteed items_json update error:", fallbackErr);
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      targetId,
      proofUrl: finalProofUrlToSave,
      usedStorage: !!storagePublicUrl
    });
  } catch (err) {
    console.error("Proof upload API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
