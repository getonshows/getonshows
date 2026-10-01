import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4f8",
          100: "#dce6f0",
          200: "#b9cde3",
          300: "#8fa9cc",
          400: "#5d7fae",
          500: "#3a5d8c",
          600: "#27486f",
          700: "#1b3a5c",
          800: "#0f2740",
          900: "#0a1c30",
          950: "#06121f",
        },
        brand: {
          DEFAULT: "#FF5A36",
          dark: "#D9482B",
          light: "#FFE9E2",
        },
        paper: "#faf7f2",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
