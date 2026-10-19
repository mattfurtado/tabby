/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./popup.tsx", "./options.tsx", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
}
