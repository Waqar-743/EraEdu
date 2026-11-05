# ERA EDU design update

Adapted the [QuizShield reference](https://waqar-743.github.io/QuizShield/) for ERA EDU.

- Transferred the original workflow SVG illustrations, fine-stroke icons, colors, typography, navigation and framed surfaces.
- The redesign applies only to the public homepage. Account screens, student/teacher/admin dashboards, course cards, assessment screens and support pages retain their pre-redesign implementation.
- Restored shared styles, color tokens, application wrappers and display preferences to their state before the redesign (`777c2b2`).
- Kept homepage-only CSS under `.home-page`, with homepage-local animation controls, reduced-motion support and offscreen animation pausing.
- Preserved ERA EDU branding, pricing, checkout entry points, route guards, data requests and assessment actions.

## Verification

- Frontend type check and production build passed.
- Existing hosting (4), submission/admin learning (10), and session/account (5) checks passed.
- Compared all non-homepage frontend files with `777c2b2`; they match exactly.
- Verified every new CSS selector is scoped to `.home-page`, and sign-in colors, button radius and fonts remain identical before and after visiting the homepage.
- Browser checks covered desktop and mobile homepage layouts, mobile navigation and Escape dismissal, animation pausing, account screens, all three dashboard roles, and light/dark preferences.
- Dashboard layout checks used temporary local sample responses. Live authentication, payments and assessment submissions were not exercised.

The homepage update is published through `main`. Development previews and temporary sample-data tools are excluded from the application source.
