/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm neutral base — cream/stone with depth
        base: {
          50: '#faf8f5',
          100: '#f5f1ec',
          200: '#ebe5dc',
          300: '#ddd5c8',
          400: '#c4b8a6',
          500: '#a89b88',
          600: '#8a7e6d',
          700: '#6b6155',
          800: '#4a443c',
          850: '#3a352f',
          900: '#2a2620',
          950: '#1a1713',
        },
        // Primary — deep teal (trust + escrow)
        rail: {
          50: '#effbf7',
          100: '#d4f5ec',
          200: '#a9eadb',
          300: '#74d8c5',
          400: '#3fbfa9',
          500: '#22a38d',
          600: '#168271',
          700: '#13685b',
          800: '#125449',
          900: '#10453d',
        },
        // Accent — warm amber (held funds, highlights)
        amber: {
          50: '#fff8eb',
          100: '#ffedc6',
          200: '#ffd988',
          300: '#ffbf4a',
          400: '#faa517',
          500: '#e0880a',
          600: '#b96a06',
          700: '#944f08',
          800: '#7a400c',
          900: '#67350f',
        },
        // Success — emerald
        mint: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Error — rose
        ember: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // Neutrals — warm stone
        ink: {
          50: '#faf8f5',
          100: '#f0ece6',
          200: '#d6cfc4',
          300: '#b0a698',
          400: '#8a7e6f',
          500: '#6b6053',
          600: '#524940',
          700: '#3d362e',
          800: '#2a2620',
          900: '#1a1713',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.12)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.08), 0 16px 40px -8px rgba(0,0,0,0.16)',
        glow: '0 0 24px -6px rgba(34,163,141,0.35)',
        amberglow: '0 0 24px -6px rgba(250,165,23,0.3)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(1.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)',
        'pulse-ring': 'pulse-ring 2.5s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
};
