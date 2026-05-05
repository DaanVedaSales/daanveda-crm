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
        // DaanVeda Design System
        // NOTE: using 'brand-' prefix to avoid overriding Tailwind's built-in
        // amber/green/red color scales (amber-50, amber-300, etc.)
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
        'table-header': '#F1F5F9',
        'nav-inactive': '#A0AEC4',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
