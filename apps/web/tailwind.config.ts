import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-2': 'var(--brand-2)',
        'on-brand': 'var(--on-brand)',
        accent: 'var(--accent)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        field: 'var(--field)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        nav: 'var(--nav)',
      },
      fontFamily: {
        sans: 'var(--font-ui)',
        display: 'var(--font-display)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
