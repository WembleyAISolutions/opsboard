import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./ui/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        slateLite: "#0F172A",
        panel: "#111827",
        panelSoft: "#1F2937",
        textPrimary: "#E5E7EB",
        textMuted: "#9CA3AF",
        accent: "#60A5FA"
      }
    }
  },
  plugins: []
};

export default config;
