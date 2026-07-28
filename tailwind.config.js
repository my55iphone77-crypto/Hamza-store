/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // كل ملفات React داخل src
    "./public/index.html"         // ملف HTML الرئيسي
  ],
  theme: {
    extend: {
      colors: {
        brandNavy: "#1e3a8a",   // الأزرق الداكن للـ Header
        brandOrange: "#f97316", // البرتقالي للأزرار والـ Highlights
      },
      fontFamily: {
        sans: ["Tajawal", "ui-sans-serif", "system-ui"], // خط عربي أنيق
      },
    },
  },
  plugins: [],
};
