# Shared visual theme

The landing page and all role dashboards share the palette and font stacks in
[`frontend/src/theme.css`](../frontend/src/theme.css). Change those variables when
updating the brand; Tailwind's `primary-*`, `ink-*`, `font-sans`, `font-display` and
`font-mono` utilities read from that file.

- Use `primary-*` for brand accents and `ink-*` for text, neutral backgrounds,
  borders and charts. Primary buttons use `bg-primary-700 text-white` with
  `hover:bg-primary-800` for readable labels.
- Use `theme-page-background` and `theme-surface` for the shared page and glass
  surfaces. Shared hero, accent and text gradients are `--gradient-brand-hero`,
  `--gradient-brand-accent` and `--gradient-brand-text`.
- Body text uses Plus Jakarta Sans; headings use Clash Display. Codes, timers and
  other data that needs fixed-width characters may use `font-mono`.
- Keep meaningful success, warning and error colours. Do not use status colours
  as unrelated decorative accents or introduce independent blue/purple palettes.
- Dark appearance is scoped to `.app-workspace` and changes the shared neutral
  and surface tokens. Public pages retain the landing theme. Dark panels with
  white text should use primary shades; overlays may use black.

For charts or SVGs, reference tokens such as
`var(--color-chart-primary-700)` for data series or
`rgb(var(--color-primary-700))` for fixed brand artwork rather than copying RGB or hex values. Chart tokens adapt for contrast in dark workspaces. Use
`text-on-accent` for a stable dark label on bright brand gradients. Avoid
inline font stacks, substring selectors such as `[class*="bg-"]`, and colour
`!important` rules: they can override hover, focus and disabled states.

Run `npm run test:theme` from `frontend` before merging visual changes. The CI
frontend job runs the same guard against palette drift, font overrides, undefined
theme tokens, forced colour rules and insufficient white-button contrast. Browser
review remains necessary when changing layouts or component states.

The existing logo wordmark remains artwork; UI font stacks apply to all live text.
The two UI fonts load globally from Google Fonts and Fontshare, with the same
system fallback on every page.

For the isolated browser review, build from `frontend` with
`npm run build -- --outDir coverage/theme-build`, then run
`node verification/theme-browser.mjs` from the repository root using the separate
Playwright installation described in `verification/README.md`. Network access to
the font providers is required to verify actual font loading. The browser checks
landing and overview/course pages for all three roles in light/dark mode, actual
font loads, CTA/link hover and keyboard focus, the join modal and mobile overflow.
All API responses use fixture data. Screenshots and results are saved under
ignored `frontend/coverage/theme-browser`.
