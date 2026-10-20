/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: "#faf9f7",
          100: "#f3f1ee",
          200: "#e6e3de",
          300: "#d3cfc8",
          400: "#a9a39a",
          500: "#7c766d",
          600: "#5c5750",
          700: "#45413c",
          800: "#2e2b28",
          900: "#211f1d",
          950: "#161514"
        },
        ginger: {
          50: "#fef6ee",
          100: "#fde9d4",
          200: "#f9cfa4",
          300: "#f4b06c",
          400: "#f09030",
          500: "#d9761c",
          600: "#c06018",
          700: "#9c4c14",
          800: "#7d3e15",
          900: "#653414",
          950: "#371907"
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
