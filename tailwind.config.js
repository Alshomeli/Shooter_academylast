/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
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
