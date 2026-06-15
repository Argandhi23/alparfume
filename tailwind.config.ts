import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brandBlack: "var(--foreground)",
        brandWhite: "var(--background)",
        brandGray: "var(--background-secondary)",
        brandBorder: "var(--border)",
        brandMuted: "var(--text-muted)",
      },
      fontFamily: {
        serif: ["var(--font-plus-jakarta)", "sans-serif"],
        sans: ["var(--font-plus-jakarta)", "sans-serif"],
        cormorant: ["var(--font-plus-jakarta)", "sans-serif"],
        "plus-jakarta": ["var(--font-plus-jakarta)", "sans-serif"],
        inter: ["var(--font-plus-jakarta)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
