/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    'text-blue-500',
    'bg-white',
    'hover:text-blue-500',
    {
      pattern: /^(bg|text|border)-(primary|secondary|gray|red|blue|green)(-\d+)?$/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /^(m|p)(t|b|l|r|x|y)?-\d+$/,
    },
    {
      pattern: /^(flex|grid|items|justify|gap)-/,
    },
    {
      pattern: /^(w|h|max-w|max-h)-/,
    },
    'animate-fade-in',
    'animate-pulse',
    'group-hover:scale-105',
    'group-hover:translate-x-1',
    'hover:-translate-y-1',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4361ee',
          light: '#738eef',
          dark: '#2f4ad0',
        },
        secondary: {
          DEFAULT: '#ff6b6b',
          light: '#ff9e9e',
          dark: '#e63e3e',
        },
        gray: {
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#6c757d',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
        },
        background: '#ffffff',
        foreground: '#333333',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      screens: {
        'xs': {'max': '576px'},
      },
    },
  },
  plugins: [],
} 