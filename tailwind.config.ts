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
        crumb: {
          bg: "#F9F6F0",
          surface: "#FFFFFF",
          "surface-alt": "#F3EFE8",
          espresso: "#28201A",
          "espresso-light": "#453831",
          muted: "#73665C",
          subtle: "#9E9084",
          border: "#E5DED4",
          "border-subtle": "#EFEAE1",
          terracotta: "#BD5A35",
          "terracotta-hover": "#A54D2B",
          "terracotta-light": "#F8EDE7",
          sage: "#4F7651",
          "sage-light": "#ECF3EC",
          amber: "#BD7527",
          "amber-light": "#FAF2E4",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(40, 32, 26, 0.04)",
        card: "0 1px 3px 0 rgba(40, 32, 26, 0.06), 0 1px 2px -1px rgba(40, 32, 26, 0.04)",
        dropdown: "0 10px 25px -5px rgba(40, 32, 26, 0.08), 0 8px 10px -6px rgba(40, 32, 26, 0.04)",
        modal: "0 20px 35px -10px rgba(40, 32, 26, 0.15), 0 10px 15px -5px rgba(40, 32, 26, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
