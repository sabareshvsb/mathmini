import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050b16",
          900: "#07101f",
          850: "#0a1526",
          800: "#0d1a2f",
          700: "#12233c",
          600: "#1a2f4d",
        },
        neon: {
          cyan: "#22d3ee",
          blue: "#38bdf8",
          green: "#34d399",
          lime: "#a3e635",
          amber: "#fbbf24",
          orange: "#fb923c",
          red: "#f87171",
          violet: "#a78bfa",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.18)",
        "glow-lg": "0 0 60px rgba(34, 211, 238, 0.22)",
        card: "0 18px 45px -20px rgba(0, 0, 0, 0.85)",
      },
      fontFamily: {
        sans: [
          "Segoe UI Variable Display",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["Cascadia Code", "Consolas", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "fade-up": "fadeUp 0.45s ease-out both",
        drift: "drift 18s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-12px,0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
