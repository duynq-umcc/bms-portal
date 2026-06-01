/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        ink: {
          DEFAULT: '#0b1120',
          2: '#111827',
        },
        amber: {
          DEFAULT: '#f59e0b',
        },
        teal: {
          DEFAULT: '#14b8a6',
        },
        t1: '#f0f4ff',
        t2: '#9baec8',
        t3: '#5a7196',
        success: { DEFAULT: '#16a34a' },
        warning: { DEFAULT: '#d97706' },
        danger: { DEFAULT: '#dc2626' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      screens: {
        'sm': '360px',
        'md': '768px',
        'lg': '1280px',
      },
    },
  },
  plugins: [],
}
