/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Naranja marca
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Negro / carbón
        ink: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#2a2a2a',
          900: '#141414',
          950: '#0a0a0a',
        },
        cream: {
          50: '#fffaf5',
          100: '#fff4eb',
          200: '#ffe8d6',
        },
        // Verde granja (acentos, badges, confianza)
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        admin: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#1c1c1e',
          900: '#0c0c0d',
          950: '#050505',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(0, 0, 0, 0.12)',
        lift: '0 12px 40px -12px rgba(234, 88, 12, 0.45)',
        card: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        glow: '0 0 0 1px rgba(249,115,22,0.25), 0 8px 32px rgba(249,115,22,0.2)',
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(ellipse 80% 60% at 15% 20%, rgba(249,115,22,0.45), transparent), radial-gradient(ellipse 50% 40% at 85% 15%, rgba(255,255,255,0.08), transparent), linear-gradient(145deg, #0a0a0a 0%, #141414 40%, #1a0f08 70%, #ea580c 160%)',
      },
    },
  },
  plugins: [],
};
