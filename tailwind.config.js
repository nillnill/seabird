/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sea-bg':     '#0A0E1A',
        'sea-panel':  '#0F1629',
        'sea-card':   '#141E35',
        'sea-border': '#1E2D4A',
        'sea-muted':  '#64748B',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
};
