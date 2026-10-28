/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cosmic: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 500: "#7c3aed", 600: "#6d28d9", 700: "#5b21b6", 900: "#1e1240" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
