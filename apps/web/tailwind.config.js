/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#145a28",
          dark: "#0a3d18",
          light: "#1e7a38",
          mid: "#186830",
        },
        rail: {
          DEFAULT: "#4a2f18",
          dark: "#2a180c",
          light: "#6b4528",
          cushion: "#3d2814",
        },
        brass: {
          DEFAULT: "#b8860b",
          light: "#d4a843",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f0d060",
          dark: "#a8860a",
        },
        "bg-casino": {
          DEFAULT: "#060612",
          mid: "#0e0a1f",
          light: "#12182e",
          accent: "#1a0f35",
        },
        success: {
          DEFAULT: "#22c55e",
          muted: "rgba(34, 197, 94, 0.2)",
        },
        error: {
          DEFAULT: "#ef4444",
          muted: "rgba(239, 68, 68, 0.2)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "rgba(245, 158, 11, 0.2)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        felt: "inset 0 0 80px rgba(0, 0, 0, 0.55), inset 0 4px 24px rgba(255, 255, 255, 0.04)",
        rail: "0 12px 40px rgba(0, 0, 0, 0.65), 0 0 0 10px var(--rail), 0 0 0 16px var(--rail-dark)",
        card: "0 4px 14px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(212, 175, 55, 0.25)",
        "card-glow": "0 0 24px var(--gold-glow)",
      },
      backgroundImage: {
        "casino-gradient":
          "radial-gradient(ellipse 120% 80% at 50% -10%, var(--bg-casino-accent) 0%, transparent 55%), linear-gradient(180deg, var(--bg-casino) 0%, var(--bg-casino-mid) 50%, #0a0818 100%)",
        "felt-gradient":
          "radial-gradient(ellipse 90% 75% at 50% 32%, var(--felt-light) 0%, var(--felt) 35%, var(--felt-mid) 60%, var(--felt-dark) 100%)",
      },
    },
  },
  plugins: [],
};
