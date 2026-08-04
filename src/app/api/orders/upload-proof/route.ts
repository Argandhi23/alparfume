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
    const rawCode = orderId || body.order_code;

    if (!rawCode || !proofUrl) {
      return NextResponse.json({ error: "Kode Pesanan (order_code) dan proofUrl wajib diisi" }, { status: 400 });
    }

    const queryCode = String(rawCode).trim();

    // Protection 1: Strictly reject numeric integer IDs (e.g. "12") to prevent integer ID manipulation attacks
    const isNumericInteger = /^\d+$/.test(queryCode);
    if (!queryCode || isNumericInteger) {
      return NextResponse.json(
        { error: "Upload bukti pembayaran hanya diizinkan menggunakan Kode Pesanan (Order Code) resmi" },
        { status: 400 }
      );
    }

    // Protection 2: Limit base64 image length to ~7MB (~5MB raw image) to prevent DoS memory exhaustion
    if (typeof proofUrl === "string" && proofUrl.length > 7 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file gambar terlalu besar (Maksimal 5MB)" }, { status: 400 });
    }

    // Protection 3: Validate image MIME type (JPG, PNG, WEBP)
    const isBase64Image = typeof proofUrl === "string" && /^data:image\/(jpeg|png|jpg|webp);base64,/i.test(proofUrl);
    const isHttpImageUrl = typeof proofUrl === "string" && /^https?:\/\/.+/i.test(proofUrl);

    if (!isBase64Image && !isHttpImageUrl) {
      return NextResponse.json({ error: "Format file tidak valid. Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Check if target exists in new 'orders' table strictly by order_code
    const { data: foundOrders } = await serviceClient
      .from("orders")
      .select("id, order_code, payment_status, fulfillment_status")
      .eq("order_code", queryCode)
      .limit(1);

    if (foundOrders && foundOrders.length > 0) {
      const targetOrder = foundOrders[0];

      // Protection 4: Reject new uploads if order is already marked 'paid' or 'completed'
      if (targetOrder.payment_status === "paid") {
        return NextResponse.json(
          { error: "Pesanan ini sudah terverifikasi LUNAS. Tidak perlu mengunggah ulang bukti pembayaran." },
          { status: 400 }
        );
      }
      if (targetOrder.fulfillment_status === "completed") {
        return NextResponse.json(
          { error: "Pesanan ini telah selesai. Tidak dapat mengunggah bukti pembayaran baru." },
          { status: 400 }
        );
      }

      // Upload image to Supabase Storage if base64
      let storagePublicUrl: string | null = null;
      try {
        if (typeof proofUrl === "string" && proofUrl.startsWith("data:image")) {
          const base64Data = proofUrl.split(",")[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, "base64");
            const fileName = `proof_${targetOrder.id}_${Date.now()}.jpg`;

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

      // Insert record into payment_proofs table (Single Source of Truth)
      const { error: proofInsertErr } = await serviceClient
        .from("payment_proofs")
        .insert([{
          order_id: targetOrder.id,
          image_url: finalProofUrlToSave
        }]);

      if (proofInsertErr) {
        console.error("Error inserting into payment_proofs:", proofInsertErr);
        return NextResponse.json({ error: proofInsertErr.message }, { status: 500 });
      }

      // Update payment_status on orders table to pending_verification (allows re-upload for pending orders)
      await serviceClient
        .from("orders")
        .update({ payment_status: "pending_verification" })
        .eq("id", targetOrder.id);

      return NextResponse.json({
        success: true,
        orderId: targetOrder.id,
        order_code: targetOrder.order_code,
        proofUrl: finalProofUrlToSave,
        usedStorage: !!storagePublicUrl
      });
    }

    // 2. Fallback Hibrid: Check historical 'order_intents' table strictly by order_code
    const { data: foundIntents } = await serviceClient
      .from("order_intents")
      .select("id, order_code, payment_status, fulfillment_status")
      .eq("order_code", queryCode)
      .limit(1);

    if (foundIntents && foundIntents.length > 0) {
      const targetIntent = foundIntents[0];

      if (targetIntent.payment_status === "paid") {
        return NextResponse.json(
          { error: "Pesanan ini sudah terverifikasi LUNAS. Tidak perlu mengunggah ulang bukti pembayaran." },
          { status: 400 }
        );
      }

      let storagePublicUrl: string | null = null;
      try {
        if (typeof proofUrl === "string" && proofUrl.startsWith("data:image")) {
          const base64Data = proofUrl.split(",")[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, "base64");
            const fileName = `proof_intent_${targetIntent.id}_${Date.now()}.jpg`;

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

      // Update order_intents row
      await serviceClient
        .from("order_intents")
        .update({
          payment_proof_url: finalProofUrlToSave,
          payment_status: "pending_verification"
        })
        .eq("id", targetIntent.id);

      return NextResponse.json({
        success: true,
        orderId: targetIntent.id,
        order_code: targetIntent.order_code,
        proofUrl: finalProofUrlToSave,
        usedStorage: !!storagePublicUrl
      });
    }

    return NextResponse.json({ error: `Pesanan "${queryCode}" tidak ditemukan. Mohon periksa kembali kode pesanan Anda.` }, { status: 404 });
  } catch (err) {
    console.error("Proof upload API error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
