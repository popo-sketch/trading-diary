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
          bg: '#0f0f0f',
          card: '#1a1a1a',
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
