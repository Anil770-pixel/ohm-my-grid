/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          blue: '#00d4ff',
          green: '#00ff87',
          red: '#ff4560',
          yellow: '#ffd700',
          purple: '#a855f7',
        },
        surface: {
          900: '#060b17',
          800: '#0a1020',
          700: '#0f172a',
          600: '#1e293b',
          500: '#334155',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          to: { boxShadow: '0 0 15px currentColor, 0 0 30px currentColor' }
        }
      }
    },
  },
  plugins: [],
}
