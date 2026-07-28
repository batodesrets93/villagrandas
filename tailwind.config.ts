import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6f4",
          100: "#dfeae4",
          500: "#2f6b52",
          600: "#255943",
          700: "#1c4534",
        },
      },
    },
  },
  plugins: [],
};
export default config;
