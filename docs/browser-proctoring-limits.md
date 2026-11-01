# Browser proctoring signals

EraEdu records only signals observable to the exam page: a document becoming
hidden or visible, window focus changes, an in-page fullscreen exit, supported
Document Picture-in-Picture entry, and optional camera-model results.

These signals are review evidence, not proof of a particular application,
screen-sharing session, recording session, or intent. In particular, the web
platform's `getDisplayMedia()` asks the *calling page's user* to choose a
surface for that page to capture; it cannot enumerate or inspect another
application's active Google Meet, operating-system, or browser capture session.

If a student externally shares a screen while the exam page stays focused and
visible, EraEdu has no reliable browser-only signal for it. This case is
unsupported and must not be described as detected.

A firm requirement to detect external sharing would require an explicit,
consent-based architecture outside this website: for example a managed-browser
extension with narrowly scoped permissions, a managed-device/native agent, or
institutional endpoint-management telemetry. Each option needs separate privacy,
security, deployment, and policy review; none is enabled by EraEdu today.

## Camera recovery and verification

The camera monitor requires a secure browser context (HTTPS or localhost),
camera permission, the bundled TinyFaceDetector and landmark models, and a live
video track. Retry reloads failed models and requests a new stream. Cancelling
a permission dialog or unmounting the monitor releases late-arriving streams.
Device, permission and model failures show an unavailable state; they do not
claim a face was absent or count an automatic misconduct violation.

A missing face or a turned-away result starts one absence episode after a
2-second grace period. Alternating those results does not reset the episode;
three consecutive positive detections end it. The episode records one event,
with automatic submission after 60 continuous seconds. A teacher's configured
event threshold can submit earlier. Head pose is a landmark heuristic, not
identity verification or reliable eye-gaze tracking.

From `frontend`, `npm run test:integrity` covers absence timing, reacquisition,
model-load retry, cancelled camera acquisition and durable event delivery.
From the repository root, `node verification/face-detection-browser.mjs` runs
the actual React hook in Chrome with a synthetic webcam and deterministic
model results. It uses the separate `PLAYWRIGHT_MODULE_PATH` / `CHROME_PATH`
setup in `verification/README.md`. This verifies integration and recovery,
not detector accuracy on real people.

Before release, use a staging student account on each supported browser/device:
verify face acquisition in normal lighting, move out of frame for over 2 seconds,
return, turn away, and test permission denial, retry, unplug/reconnect and model
download failure. Confirm the warning, teacher event timeline and configured
submission threshold. Test real-camera accuracy across lighting, glasses and
camera positions; those conditions cannot be certified by synthetic fixtures.
