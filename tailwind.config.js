/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2', 100: '#ffe1e3', 200: '#ffc6ca', 300: '#ff9ba2',
          400: '#ff6570', 500: '#f42b38', 600: '#D71920', 700: '#b81019',
          800: '#98151c', 900: '#77171d', 950: '#39090e',
        },
        slate: {
          300: '#c4ccd8', 400: '#a6b2c4', 500: '#7e8b9f',
          600: '#586579', 700: '#344150', 800: '#263240',
          900: '#171B22', 950: '#0B0D10',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
      },
      keyframes: {
        ping: {
          '75%, 100%': { transform: 'scale(1.6)', opacity: 0 },
        },
      },
    },
  },
  plugins: [],
};
