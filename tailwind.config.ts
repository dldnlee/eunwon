import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Brand & primary
        primary: "#0a0a0a",
        "on-primary": "#ffffff",
        "primary-soft": "#181e25",

        // Brand accents (narrow, documented uses only — see DESIGN.md adaptation notes)
        "brand-coral": "#ff5530",
        "brand-magenta": "#ea5ec1",
        "brand-blue": "#1456f0",
        "brand-blue-mid": "#3b82f6",
        "brand-blue-deep": "#1d4ed8",
        "brand-blue-700": "#17437d",
        "brand-cyan": "#3daeff",
        "brand-blue-200": "#bfdbfe",
        "brand-purple": "#a855f7",

        // Surfaces
        canvas: "#ffffff",
        surface: "#f7f8fa",
        "surface-soft": "#f2f3f5",
        hairline: "#e5e7eb",
        "hairline-soft": "#eaecf0",

        // Text
        ink: "#0a0a0a",
        "ink-strong": "#000000",
        charcoal: "#222222",
        slate: "#45515e",
        steel: "#5f5f5f",
        stone: "#8e8e93",
        muted: "#a8aab2",

        // Semantic
        "success-bg": "#e8ffea",
        "success-text": "#1ba673",
        error: "#d45656",
        "on-dark": "#ffffff",
        "footer-bg": "#0a0a0a",
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "Inter",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // Type scale from DESIGN.md — [fontSize, { lineHeight, letterSpacing, fontWeight }]
        "hero-display": ["80px", { lineHeight: "1.10", letterSpacing: "-2px", fontWeight: "600" }],
        "display-lg": ["56px", { lineHeight: "1.10", letterSpacing: "-1.5px", fontWeight: "600" }],
        "heading-lg": ["40px", { lineHeight: "1.20", letterSpacing: "-1px", fontWeight: "600" }],
        "heading-md": ["32px", { lineHeight: "1.25", letterSpacing: "-0.5px", fontWeight: "600" }],
        "heading-sm": ["24px", { lineHeight: "1.30", fontWeight: "600" }],
        "card-title": ["20px", { lineHeight: "1.40", fontWeight: "600" }],
        subtitle: ["18px", { lineHeight: "1.50", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "1.50", fontWeight: "400" }],
        "body-md-bold": ["16px", { lineHeight: "1.50", fontWeight: "700" }],
        "body-sm": ["14px", { lineHeight: "1.50", fontWeight: "400" }],
        "body-sm-medium": ["14px", { lineHeight: "1.50", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "1.70", fontWeight: "400" }],
        "caption-bold": ["13px", { lineHeight: "1.50", fontWeight: "600" }],
        micro: ["12px", { lineHeight: "1.50", fontWeight: "400" }],
        "button-md": ["14px", { lineHeight: "1.40", fontWeight: "600" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        xxl: "20px",
        xxxl: "24px",
        hero: "32px",
        full: "9999px",
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        xxl: "32px",
        xxxl: "40px",
        "section-sm": "48px",
        section: "64px",
        "section-lg": "80px",
        hero: "96px",
      },
      boxShadow: {
        subtle: "0px 1px 2px 0px rgba(0, 0, 0, 0.04)",
        card: "0px 4px 6px 0px rgba(0, 0, 0, 0.08)",
        atmospheric: "0px 0px 22px 0px rgba(0, 0, 0, 0.08)",
        modal: "0px 12px 16px -4px rgba(36, 36, 36, 0.08)",
        // A thin brand-blue ring plus a soft outer bloom — used to highlight cards with a
        // strong AI 매칭도 rating (see components/ProgramCard.tsx).
        glow: "0 0 0 1.5px rgba(59, 130, 246, 0.55), 0 0 18px 2px rgba(59, 130, 246, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
