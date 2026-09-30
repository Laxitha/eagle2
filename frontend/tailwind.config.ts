import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f172a",
        surface: "#1e293b",
        blue: "#3b82f6",
        amber: "#f59e0b",
        entity: {
          person: "#3b82f6",
          phone: "#22c55e",
          case: "#ef4444",
          vehicle: "#f97316",
          account: "#a855f7",
          location: "#eab308",
        },
      },
    },
  },
  plugins: [],
};
export default config;
