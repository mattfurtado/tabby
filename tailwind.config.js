/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./popup.tsx", "./options.tsx", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#fbf8f3",
          100: "#f4eee5",
          200: "#e7dfd3",
          300: "#d4c9b9",
          400: "#a99d8c",
          500: "#7d7264",
          600: "#5d544a",
          700: "#463e36",
          800: "#2f2924",
          900: "#221d19",
          950: "#171310"
        },
        ginger: {
          50: "#fff7ec",
          100: "#ffecd2",
          200: "#ffd6a3",
          300: "#ffbd6b",
          400: "#ffa830",
          500: "#f09030",
          600: "#d9761c",
          700: "#b35a17",
          800: "#8f4718",
          900: "#733b17",
          950: "#3e1c08"
        },
        moss: {
          300: "#d0de8c",
          400: "#b5c95a",
          500: "#9bb33f",
          600: "#7d9230"
        }
      }
    }
  },
  plugins: []
}
