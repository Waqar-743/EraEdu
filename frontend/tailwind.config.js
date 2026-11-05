/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', ':root[data-theme="dark"] .app-workspace'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: Object.fromEntries([0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [shade, `rgb(var(--color-ink-${shade}) / <alpha-value>)`])),
        primary: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [shade, `rgb(var(--color-primary-${shade}) / <alpha-value>)`])),
      },
      // Text accents adapt independently so filled buttons keep their contrast.
      textColor: {
        primary: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(shade => [shade, `rgb(var(--color-primary-${shade >= 600 ? 'text-' : ''}${shade}) / <alpha-value>)`])),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      letterSpacing: {
        tightest: '-0.05em',
        eyebrow: '0.22em',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'glide': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'haptic': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -8px rgb(var(--color-primary-950) / 0.08)',
        'lift': '0 24px 60px -20px rgb(var(--color-primary-950) / 0.18), 0 2px 4px rgb(var(--color-primary-950) / 0.04)',
        'glow-emerald': '0 0 0 1px rgb(var(--color-primary-500) / 0.18), 0 20px 60px -20px rgb(var(--color-primary-500) / 0.45)',
        'inner-hl': 'inset 0 1px 0 rgba(255,255,255,0.6)',
        'inner-hl-dark': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'mesh-emerald': 'radial-gradient(at 18% 22%, rgb(var(--color-primary-500) / 0.18) 0px, transparent 45%), radial-gradient(at 82% 10%, rgb(var(--color-primary-300) / 0.14) 0px, transparent 50%), radial-gradient(at 50% 90%, rgb(var(--color-primary-700) / 0.10) 0px, transparent 55%)',
        'grid-faint': "linear-gradient(rgb(var(--color-primary-950) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--color-primary-950) / 0.04) 1px, transparent 1px)",
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(28px)', filter: 'blur(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'orbit': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 900ms cubic-bezier(0.16,1,0.3,1) both',
        'pulse-soft': 'pulse-soft 6s ease-in-out infinite',
        'orbit-slow': 'orbit 28s linear infinite',
        'shimmer': 'shimmer 2.4s cubic-bezier(0.32,0.72,0,1) infinite',
        'marquee': 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
}
