/**
 * Helper utility for parsing and sanitizing image URLs across AL PARFUME website.
 * Prevents broken images, unencoded spaces/special characters, mixed content (http vs https),
 * and double JSON stringified URLs.
 */

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let trimmed = url.trim();

  if (!trimmed || trimmed === "/placeholder.jpg" || trimmed.includes("placeholder.jpg")) {
    return null;
  }

  // Unwrap double JSON encoding like '"[\"https://...\"]"' or '"https://..."'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      const unwrapped = JSON.parse(trimmed);
      if (typeof unwrapped === "string") {
        trimmed = unwrapped.trim();
      }
    } catch {
      // Ignore parse error
    }
  }

  // Handle JSON array strings like '["https://..."]'
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstValid = parsed.find((item) => item && typeof item === "string" && item.trim().length > 0);
        if (firstValid) {
          trimmed = firstValid.trim();
        } else {
          return null;
        }
      }
    } catch {
      // Fallback
    }
  }

  if (!trimmed || trimmed === "/placeholder.jpg") return null;

  // Convert http:// to https:// for Supabase URLs (prevents WebKit/iOS Safari mixed content block)
  if (trimmed.startsWith("http://")) {
    trimmed = trimmed.replace("http://", "https://");
  }

  // Safely encode URI for filenames containing spaces or parentheses e.g. "my image (1).png"
  try {
    if (trimmed !== decodeURI(trimmed)) {
      return trimmed;
    }
    return encodeURI(trimmed);
  } catch {
    return trimmed;
  }
}

export function parseProductImages(imageUrl: string | null | undefined): string[] {
  if (!imageUrl || typeof imageUrl !== "string") return [];
  let trimmed = imageUrl.trim();

  // Unwrap double JSON encoding if present
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      const unwrapped = JSON.parse(trimmed);
      if (typeof unwrapped === "string") {
        trimmed = unwrapped.trim();
      }
    } catch {
      // Ignore
    }
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((url) => sanitizeImageUrl(url))
          .filter((url): url is string => Boolean(url));
      }
    } catch {
      // Fallback below
    }
  }

  const sanitized = sanitizeImageUrl(trimmed);
  return sanitized ? [sanitized] : [];
}
