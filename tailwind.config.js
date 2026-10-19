/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./popup.tsx", "./options.tsx", "./src/**/*.{ts,tsx}"],
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
        ember: {
          50: "#fdf6ef",
          100: "#fae9d6",
          200: "#f4cfa8",
          300: "#ecb072",
          400: "#e38f45",
          500: "#d97528",
          600: "#c25f1e",
          700: "#a14a1b",
          800: "#823d1d",
          900: "#6a341b",
          950: "#3a190b"
        }
      }
    }
  },
  plugins: []
}
