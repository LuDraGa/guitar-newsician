/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PRIMARY (60%) - Dark neutral backgrounds
        dark: {
          50: '#262626',
          100: '#1f1f1f',
          200: '#1a1a1a',
          300: '#171717',
          400: '#0a0a0a', // Main bg - true black
          500: '#080808',
          600: '#050505',
          700: '#030303',
          800: '#020202',
          900: '#000000',
        },
        // SECONDARY (30%) - Light grays for content
        gray: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // ACCENT (10%) - Vibrant cyan/blue for CTAs and highlights
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4', // Main accent
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
      fontFamily: {
        // HEADING font - Bold, impactful
        display: [
          'Space Grotesk',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        // BODY font - Clean, readable
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // ACCENT font - Technical, modern (for buttons, labels)
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Consolas',
          'Monaco',
          'Courier New',
          'monospace',
        ],
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
      },
      lineHeight: {
        none: '1',
        tight: '1.15',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.7',
        loose: '2',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-accent': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan accent
        'gradient-dark': 'linear-gradient(180deg, #0a0a0a 0%, #000000 100%)', // Pure dark
        'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(6, 182, 212, 0.1) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(6, 182, 212, 0.08) 0px, transparent 50%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': {
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.4)',
          },
          'to': {
            boxShadow: '0 0 30px rgba(147, 51, 234, 0.8), 0 0 60px rgba(147, 51, 234, 0.4)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
