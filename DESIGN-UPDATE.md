# ERA EDU design update

Adapted the [QuizShield reference](https://waqar-743.github.io/QuizShield/) for ERA EDU.

- The public homepage owns the workflow illustrations, animated graphics, green palette, display fonts, illustrated brand, framed surfaces, and animation controls.
- Every marketing CSS selector is scoped to `.home-page`. Marketing colors and fonts are CSS variables on that element, with separate system-font and blue/neutral defaults for the application.
- Removed the dashboard SVG watermark, open-book background, ambient mesh, green gradient headers/sidebar, gradient avatars, and teal overrides that recolored existing internal controls.
- Replaced internal marketing headers, framed statistic cards, and illustrated branding with plain application controls. Account, course, exam, profile/settings, contact, privacy, and terms screens use the application defaults.
- The homepage has its own `HomepageBrand` component and route-owned favicon. Leaving the homepage restores the plain application favicon.
- Retained reduced-motion support, offscreen animation pausing, and saved light/dark/sidebar preferences. Dark workspace surfaces use neutral slate colors.
- Preserved ERA EDU branding, pricing, checkout entry points, route guards, data requests and assessment actions.

## Verification

- `npm run test:homepage-isolation` checks stylesheet boundaries, imports, removed dashboard artwork, neutral defaults, and retained homepage illustrations. It also runs in GitHub CI.
- Existing hosting (4), submission/admin learning (10), and session/account (5) checks pass.
- Browser checks verify student, teacher, and admin dashboards have zero decorative image/gradient backgrounds and use system fonts.
- Checked course management and creation, account settings, theme and collapse preferences, and the mobile sidebar using temporary local sample responses.
- Compared actual login fonts and button colors before and after client-side navigation through the homepage; they remain identical.
- The homepage still renders all 11 artwork components with its own fonts and green palette.
- Live authentication, payments, and assessment submissions are outside the local appearance checks.

The homepage update is published through `main`. Development previews and temporary sample-data tools are excluded from the application source.
