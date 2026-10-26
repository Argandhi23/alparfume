import QRCode from "qrcode";

/**
 * Official Static QRIS Payload for ALPARFUME.CO
 * Merchant: ALPARFUME.CO (Kota Madiun - 63131)
 * NMID: ID1026602610382 (A01)
 */
export const ALPARFUME_STATIC_QRIS =
  process.env.NEXT_PUBLIC_QRIS_STATIC_PAYLOAD ||
  "00020101021126570011ID.DANA.WWW011893600915303543397902090354339790303UMI51440014ID.CO.QRIS.WWW0215ID10266026103820303UMI5204561153033605802ID5912ALPARFUME.CO6011Kota Madiun6105631316304C567";

export const ALPARFUME_MERCHANT_INFO = {
  name: "ALPARFUME.CO",
  nmid: "ID1026602610382",
  terminal: "A01",
  city: "Kota Madiun",
};

/**
 * Calculates CRC16-CCITT (0xFFFF initial value, 0x1021 polynomial)
 * required by EMVCo / ASPI QRIS specification (Tag 63).
 */
export function calculateCrc16Ccitt(payloadWithoutCrcValue: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCrcValue.length; i++) {
    crc ^= payloadWithoutCrcValue.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface EmvTlvNode {
  tag: string;
  length: number;
  value: string;
}

/**
 * Parses an EMVCo QRIS string into an array of top-level TLV (Tag-Length-Value) nodes.
 */
function parseEmvTlv(qrisString: string): EmvTlvNode[] {
  const nodes: EmvTlvNode[] = [];
  let index = 0;

  while (index + 4 <= qrisString.length) {
    const tag = qrisString.slice(index, index + 2);
    const lenStr = qrisString.slice(index, index + 4).slice(2, 4);
    const length = parseInt(lenStr, 10);

    if (isNaN(length) || length < 0 || index + 4 + length > qrisString.length) {
      break;
    }

    const value = qrisString.slice(index + 4, index + 4 + length);
    nodes.push({ tag, length, value });
    index += 4 + length;
  }

  return nodes;
}

/**
 * Formats a single TLV node into EMVCo string representation.
 */
function formatTlv(tag: string, value: string): string {
  const lengthStr = value.length.toString().padStart(2, "0");
  return `${tag}${lengthStr}${value}`;
}

/**
 * Converts a static EMVCo QRIS string into a Dynamic QRIS string with a locked transaction amount (Tag 54).
 *
 * - Sets Tag 01 (Point of Initiation Method) to "12" (Dynamic) when amount > 0
 * - Injects Tag 54 (Transaction Amount) right after Tag 53 (Currency 360)
 * - Recomputes Tag 63 (CRC16-CCITT checksum)
 */
export function generateDynamicQrisPayload(
  amount: number,
  baseStaticQris: string = ALPARFUME_STATIC_QRIS
): string {
  const cleanAmount = Math.round(Number(amount) || 0);
  if (cleanAmount <= 0) {
    return baseStaticQris;
  }

  const amountStr = String(cleanAmount);
  const parsedNodes = parseEmvTlv(baseStaticQris);

  if (parsedNodes.length === 0) {
    return baseStaticQris;
  }

  const rebuiltParts: string[] = [];
  let amountInserted = false;

  for (const node of parsedNodes) {
    if (node.tag === "63" || node.tag === "54") {
      continue;
    }

    if (node.tag === "01") {
      // "12" indicates Dynamic QRIS with embedded amount
      rebuiltParts.push(formatTlv("01", "12"));
      continue;
    }

    if (node.tag === "58" && !amountInserted) {
      rebuiltParts.push(formatTlv("54", amountStr));
      amountInserted = true;
    }

    rebuiltParts.push(formatTlv(node.tag, node.value));

    if (node.tag === "53" && !amountInserted) {
      rebuiltParts.push(formatTlv("54", amountStr));
      amountInserted = true;
    }
  }

  if (!amountInserted) {
    rebuiltParts.push(formatTlv("54", amountStr));
  }

  const payloadWithCrcHeader = `${rebuiltParts.join("")}6304`;
  const crcHex = calculateCrc16Ccitt(payloadWithCrcHeader);

  return `${payloadWithCrcHeader}${crcHex}`;
}

/**
 * Generates a clean, plain (polos) Dynamic QRIS image with the bill amount (tagihan)
 * cleanly printed right below the QR code on a pure white card.
 */
export async function generateDynamicQrisTemplateDataUrl(
  amount: number,
  baseStaticQris: string = ALPARFUME_STATIC_QRIS
): Promise<string> {
  const payload = generateDynamicQrisPayload(amount, baseStaticQris);

  const plainQrUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 560,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  if (typeof window === "undefined") {
    return plainQrUrl;
  }

  return new Promise((resolve) => {
    const qrImg = new window.Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      try {
        const width = 600;
        const height = 680;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(plainQrUrl);
          return;
        }

        // Pure plain white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // Crisp plain QR code
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrImg, 30, 20, 540, 540);

        // Clean nominal tagihan right below the QR code
        const formattedNominal = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(amount);

        ctx.textAlign = "center";
        ctx.fillStyle = "#737373";
        ctx.font = "600 15px sans-serif";
        ctx.fillText("TOTAL TAGIHAN", width / 2, 592);

        ctx.fillStyle = "#111111";
        ctx.font = "bold 36px monospace";
        ctx.fillText(formattedNominal, width / 2, 640);

        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(plainQrUrl);
      }
    };
    qrImg.onerror = () => resolve(plainQrUrl);
    qrImg.src = plainQrUrl;
  });
}
