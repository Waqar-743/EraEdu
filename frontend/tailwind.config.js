/** @type {import('tailwindcss').Config} */
export default {
  "content": [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  "theme": {
    "extend": {
      "colors": {
        "ink": {
          "0": "#FFFFFF",
          "50": "#F7F8F9",
          "100": "#EFF1F3",
          "200": "#DCE0E5",
          "300": "#B7BFC8",
          "400": "#7E8896",
          "500": "#56606E",
          "600": "#3A434F",
          "700": "#262C36",
          "800": "#161A22",
          "900": "#0B0E14",
          "950": "#05070B"
        },
        "primary": {
          "50": "rgb(var(--color-primary-50, 239 246 255) / <alpha-value>)",
          "100": "rgb(var(--color-primary-100, 219 234 254) / <alpha-value>)",
          "200": "rgb(var(--color-primary-200, 191 219 254) / <alpha-value>)",
          "300": "rgb(var(--color-primary-300, 147 197 253) / <alpha-value>)",
          "400": "rgb(var(--color-primary-400, 96 165 250) / <alpha-value>)",
          "500": "rgb(var(--color-primary-500, 59 130 246) / <alpha-value>)",
          "600": "rgb(var(--color-primary-600, 37 99 235) / <alpha-value>)",
          "700": "rgb(var(--color-primary-700, 29 78 216) / <alpha-value>)",
          "800": "rgb(var(--color-primary-800, 30 64 175) / <alpha-value>)",
          "900": "rgb(var(--color-primary-900, 30 58 138) / <alpha-value>)",
          "950": "rgb(var(--color-primary-950, 23 37 84) / <alpha-value>)"
        },
        "accent": {
          "50": "rgb(var(--color-accent-50, 248 250 252) / <alpha-value>)",
          "100": "rgb(var(--color-accent-100, 241 245 249) / <alpha-value>)",
          "200": "rgb(var(--color-accent-200, 226 232 240) / <alpha-value>)",
          "300": "rgb(var(--color-accent-300, 203 213 225) / <alpha-value>)",
          "400": "rgb(var(--color-accent-400, 148 163 184) / <alpha-value>)",
          "500": "rgb(var(--color-accent-500, 100 116 139) / <alpha-value>)",
          "600": "rgb(var(--color-accent-600, 71 85 105) / <alpha-value>)",
          "700": "rgb(var(--color-accent-700, 51 65 85) / <alpha-value>)",
          "800": "rgb(var(--color-accent-800, 30 41 59) / <alpha-value>)",
          "900": "rgb(var(--color-accent-900, 15 23 42) / <alpha-value>)"
        },
        "secondary": {
          "50": "rgb(var(--color-secondary-50, 245 243 255) / <alpha-value>)",
          "100": "rgb(var(--color-secondary-100, 237 233 254) / <alpha-value>)",
          "200": "rgb(var(--color-secondary-200, 221 214 254) / <alpha-value>)",
          "300": "rgb(var(--color-secondary-300, 196 181 253) / <alpha-value>)",
          "400": "rgb(var(--color-secondary-400, 167 139 250) / <alpha-value>)",
          "500": "rgb(var(--color-secondary-500, 139 92 246) / <alpha-value>)",
          "600": "rgb(var(--color-secondary-600, 124 58 237) / <alpha-value>)",
          "700": "rgb(var(--color-secondary-700, 109 40 217) / <alpha-value>)",
          "800": "rgb(var(--color-secondary-800, 91 33 182) / <alpha-value>)",
          "900": "rgb(var(--color-secondary-900, 76 29 149) / <alpha-value>)"
        }
      },
      "fontFamily": {
        "sans": [
          "var(--font-sans, ui-sans-serif)",
          "system-ui",
          "sans-serif"
        ],
        "display": [
          "var(--font-display, ui-sans-serif)",
          "system-ui",
          "sans-serif"
        ],
        "mono": [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace"
        ]
      },
      "letterSpacing": {
        "tightest": "-0.05em",
        "eyebrow": "0.22em"
      },
      "transitionTimingFunction": {
        "spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "glide": "cubic-bezier(0.16, 1, 0.3, 1)",
        "haptic": "cubic-bezier(0.34, 1.56, 0.64, 1)"
      },
      "boxShadow": {
        "soft": "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -8px rgba(15,23,42,0.08)",
        "lift": "0 24px 60px -20px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.04)",
        "glow-emerald": "0 0 0 1px rgba(16,185,129,0.18), 0 20px 60px -20px rgba(16,185,129,0.45)",
        "inner-hl": "inset 0 1px 0 rgba(255,255,255,0.6)",
        "inner-hl-dark": "inset 0 1px 0 rgba(255,255,255,0.08)"
      },
      "backgroundImage": {
        "mesh-emerald": "radial-gradient(at 18% 22%, rgba(16,185,129,0.18) 0px, transparent 45%), radial-gradient(at 82% 10%, rgba(34,211,238,0.14) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(4,120,87,0.10) 0px, transparent 55%)",
        "grid-faint": "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)"
      },
      "keyframes": {
        "fade-rise": {
          "0%": {
            "opacity": "0",
            "transform": "translateY(28px)",
            "filter": "blur(8px)"
          },
          "100%": {
            "opacity": "1",
            "transform": "translateY(0)",
            "filter": "blur(0)"
          }
        },
        "pulse-soft": {
          "0%,100%": {
            "opacity": "0.55",
            "transform": "scale(1)"
          },
          "50%": {
            "opacity": "1",
            "transform": "scale(1.04)"
          }
        },
        "orbit": {
          "0%": {
            "transform": "rotate(0deg)"
          },
          "100%": {
            "transform": "rotate(360deg)"
          }
        },
        "shimmer": {
          "0%": {
            "transform": "translateX(-100%)"
          },
          "100%": {
            "transform": "translateX(100%)"
          }
        },
        "marquee": {
          "0%": {
            "transform": "translateX(0)"
          },
          "100%": {
            "transform": "translateX(-50%)"
          }
        }
      },
      "animation": {
        "fade-rise": "fade-rise 900ms cubic-bezier(0.16,1,0.3,1) both",
        "pulse-soft": "pulse-soft 6s ease-in-out infinite",
        "orbit-slow": "orbit 28s linear infinite",
        "shimmer": "shimmer 2.4s cubic-bezier(0.32,0.72,0,1) infinite",
        "marquee": "marquee 40s linear infinite"
      }
    }
  },
  "plugins": []
};
