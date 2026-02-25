/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: '#C8AA6E',
        noir: {
          panel: 'rgb(10, 10, 12)',
        },
      },
    },
  },
  plugins: [],
};
