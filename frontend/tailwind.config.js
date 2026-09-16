/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: '#FFFFFF',
          hover: '#B50016',
        },
        secondary: {
          DEFAULT: '#007AFF',
          foreground: '#FFFFFF',
        },
        success: '#34C759',
        warning: '#FF9500',
        error: '#FF3B30',
        info: '#007AFF',
      },
      backgroundImage: {
        'primary-glow': 'radial-gradient(circle at center, rgba(217, 0, 24, 0.12) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
