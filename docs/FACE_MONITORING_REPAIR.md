# Face monitoring follow-up — 3 November 2026

## Causes and repair

Two independent defects kept camera violations from working through both exam
flows:

1. **The installed model runtime could fail or hang during inference.**
   `face-api.js@0.20.0` requires TensorFlow core `1.0.3`, but its permissive
   `tfjs-image-recognition-base` range selected `0.6.2`, which brings TensorFlow
   `1.7.4`. Running real landmarks reproduced an undefined-backend error.
   The nested override and lockfile now select recognition base `0.6.0`, sharing
   TensorFlow core `1.0.3`. The old composable `withFaceLandmarks()` task also
   swallowed rejections; direct detector and landmark Promise APIs now propagate
   them. Each inference uses one decoded canvas snapshot, avoiding the old
   library's live-video readiness wait and keeping the crop on the same frame.
2. **Topic exams did not mount camera monitoring or persist its reports.**
   The topic route now mounts the shared camera and uses the account-bound
   durable integrity outbox. Question changes preserve the camera lifecycle.
   The backend accepts topic camera reports using the authenticated attempt,
   attributes them to the current course owner, includes them in teacher review
   and summaries, and preserves graded answers and scores on automatic completion.
   Stable event IDs make retries idempotent, including late evidence.

Initial WebGL shader compilation on the verification machine took approximately
10.74 seconds: 5.8 seconds for the detector and 4.9 seconds for landmarks. A
ten-second startup timeout incorrectly classified that successful first inference
as unavailable. The first inference now has a bounded 30-second allowance;
subsequent calls retain ten seconds. A timed-out call stops automatic inference
until Retry, preventing overlapping hung operations. Model, playback and device
failures reset the absence episode and remain operational states, not violations.

The existing two-second absence grace and three positive frames for reacquisition
remain in effect. Teacher exam policy remains authoritative; topic exams use the
existing three-report limit. The topic camera hides the unrelated 60-second UI
fallback because topic completion uses that report limit.

## Verification

Run from the repository root after installing frontend dependencies:

```text
node verification/face-real-model-browser.mjs
node verification/face-detection-browser.mjs
```

Set `PLAYWRIGHT_MODULE_PATH` to an installed `playwright-core/index.mjs` if it is
not installed locally. `CHROME_PATH` optionally overrides the default Windows
Chrome executable. The real-model harness owns a source Vite server on port 4183;
the deterministic harness uses 4174. Both close their browser and server.

Verified on 3 November 2026:

- **Real models: two exam routes passed.** The actual code and topic pages loaded
  the bundled detector and 68-point landmark weights, acquired a canvas video
  stream containing the bundled face photograph, positively recognized a face,
  recorded blank frames once per absence episode, received a successful report
  response, removed its acknowledged outbox entry, reacquired a face, and recorded
  a second absence. A controlled rejection from the real detector object showed
  unavailable; Retry restored positive detection without adding a violation.
- **Deterministic browser hook: four scenario groups passed.** These cover
  StrictMode model sharing, model retry, sustained absence and one automatic
  submit, reacquisition, inference failure, and late camera cleanup.
- All 31 frontend verification tests, frontend type checking and lint passed.
  Backend topic regression coverage checks retry identity, score preservation,
  late evidence, current teacher access and reassigned-course summaries.

The real-model test uses the real frontend and model weights with fixture API
responses. Its report persistence assertion verifies request acknowledgement and
outbox removal; backend service and isolated database checks provide separate
persistence coverage. It does not connect to a production database or a physical
webcam. It establishes positive photo/blank detection and application recovery,
not population accuracy, real head-turn calibration, liveness or spoof resistance.
Physical camera/browser/lighting acceptance still follows
[browser-proctoring-limits.md](browser-proctoring-limits.md).

The bundled face photograph is the NASA Eileen Collins image distributed by
scikit-image. Its source and public-domain statement are recorded in
[the fixture README](../verification/fixtures/README.md). No identity descriptor
or identity comparison is computed.
