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
          bg: '#121212',
          card: '#1e1e2e',
        },
        profit: '#10B981',
        loss: '#EF4444',
        neutral: '#6B7280',
        accent: '#3B82F6',
      },
      minWidth: {
        'app': '1200px',
      },
    },
  },
  plugins: [],
}
