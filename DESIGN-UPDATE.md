# ERA EDU design update

Adapted the [QuizShield reference](https://waqar-743.github.io/QuizShield/) for ERA EDU.

- Transferred the original workflow SVG illustrations, fine-stroke icons, colors, typography, navigation and framed surfaces.
- Applied the shared design to account screens, student/teacher/admin dashboards, course cards, assessment screens and support pages.
- Preserved ERA EDU branding, pricing, checkout entry points, route guards, data requests and assessment actions.
- Added a saved animation preference, reduced-motion support, offscreen animation pausing and keyboard focus styles.
- Kept desktop navigation fixed while workspace content scrolls independently.

## Verification

- Frontend type check and production build passed.
- Existing hosting (4), submission/admin learning (10), and session/account (5) checks passed.
- Browser checks covered desktop and mobile homepage layouts, mobile navigation and Escape dismissal, animation pausing, account screens, all three dashboard roles, and light/dark preferences.
- Dashboard layout checks used temporary local sample responses. Live authentication, payments and assessment submissions were not exercised.

The update is isolated on `ui/quizshield-design`. Development previews and temporary sample-data tools are excluded from the application source.
