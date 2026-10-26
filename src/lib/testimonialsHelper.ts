import fs from "fs";
import path from "path";
import { Testimonial } from "./supabase";
import { DEFAULT_TESTIMONIALS } from "@/data/testimonials";

const JSON_FILE_PATH = path.join(process.cwd(), "src", "data", "testimonials.json");

/**
 * Safely reads testimonials from the local JSON store with fallback to DEFAULT_TESTIMONIALS
 */
export function getLocalTestimonials(): Testimonial[] {
  try {
    if (fs.existsSync(JSON_FILE_PATH)) {
      const data = fs.readFileSync(JSON_FILE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Testimonial[];
      }
    }
  } catch (err) {
    console.warn("Failed to read local testimonials JSON file:", err);
  }
  return DEFAULT_TESTIMONIALS;
}

/**
 * Safely persists testimonials to the local JSON store
 */
export function saveLocalTestimonials(testimonials: Testimonial[]): boolean {
  try {
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(testimonials, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write local testimonials JSON file:", err);
    return false;
  }
}
