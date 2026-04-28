import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A56DB',
        navy: '#0F172A',
        foreground: '#0F172A',
        background: '#F8FAFC',
        'brand-green': '#059669',
        'brand-amber': '#F59E0B',
        'brand-danger': '#EF4444',
        muted: '#64748B',
        'brand-border': '#E2E8F0',
        card: '#FFFFFF',
        'surface-inset': '#F1F5F9',
        'surface-deep': '#F8FAFC',
        'table-header': '#F1F5F9',
        'nav-inactive': '#94A3B8',
      },
      borderRadius: {
        '3xl': '1.25rem',
        '2xl': '1rem',
        xl: '0.75rem',
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        // Design system elevation tiers
        'card':    '0 1px 4px rgba(15, 23, 42, 0.06)',
        'raised':  '0 2px 8px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'lifted':  '0 4px 16px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'float':   '0 8px 32px rgba(15, 23, 42, 0.10), 0 2px 8px rgba(15, 23, 42, 0.06)',
        'panel':   '0 16px 48px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)',
        'glow-blue': '0 0 0 3px rgba(26, 86, 219, 0.12)',
        'inner-xs': 'inset 0 1px 2px rgba(15, 23, 42, 0.06)',
      },
      fontSize: {
        'display':  ['1.75rem',  { lineHeight: '2rem',   letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading':  ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body':     ['0.8125rem', { lineHeight: '1.375rem', letterSpacing: '0',       fontWeight: '400' }],
        'label':    ['0.6875rem', { lineHeight: '1rem',   letterSpacing: '0.06em',  fontWeight: '600' }],
        'micro':    ['0.625rem',  { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '500' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-up':       'slide-up 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'shimmer':        'shimmer 1.6s linear infinite',
        'pulse-soft':     'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
