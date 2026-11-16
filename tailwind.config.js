/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      // Nevora: Inter no corpo, Space Grotesk em títulos, JetBrains Mono em dados e atalhos.
      fontFamily: {
        sans: ['"Inter Variable"', 'Segoe UI', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk Variable"', '"Inter Variable"', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'Consolas', 'monospace']
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        field: 'rgb(var(--field) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        overlay: 'rgb(var(--overlay) / <alpha-value>)'
      },
      // Escala de raio do Nevora: sm 8 (inputs, botões), md 12 (cards internos), lg 16 (painéis, modais), xl 24.
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px'
      },
      fontSize: { xs: ['0.75rem', '1rem'], sm: ['0.8125rem', '1.25rem'] }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
