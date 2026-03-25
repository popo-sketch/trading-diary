/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0d0d1a',
          card: '#1a1a2e',
          hover: '#242442',
        },
        profit: '#00c853',
        loss: '#ff1744',
        warning: '#ffc107',
        info: '#42a5f5',
        neutral: '#9e9e9e',
        accent: '#42a5f5',
      },
      minWidth: {
        'app': '1200px',
      },
    },
  },
  plugins: [],
}
