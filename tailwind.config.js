/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./overlay.html",
    "./index.html",
    "./server.js"
  ],
  theme: {
    extend: {
      colors: {
        kickgreen: '#53fc18',
      }
    },
  },
  plugins: [],
} 