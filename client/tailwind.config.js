/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#071426', dark: '#020A14', 700: '#0d2038', 600: '#15304f' },
        gold: { DEFAULT: '#D9A72E', light: '#F4D477', dark: '#B68716' },
        surface: '#F7F8FA', ink: '#17202A',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['"Playfair Display"', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
};
