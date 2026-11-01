// Actual React hook + synthetic Chrome webcam + deterministic model output.
// This exercises lifecycle/reporting, not model accuracy on a real person's face.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend');

const models = `
  const fixture = window.__face;
  const load = async () => { fixture.modelLoads++; if (fixture.modelFailure) throw new Error('fixture model offline'); };
  export const nets = { tinyFaceDetector: { loadFromUri: load }, faceLandmark68Net: { loadFromUri: async () => {} } };
  export class TinyFaceDetectorOptions { constructor(options) { Object.assign(this, options); } }
  export const detectSingleFace = () => ({ withFaceLandmarks: async () => {
    fixture.inferences++;
    if (fixture.inferenceFailure) throw new Error('fixture inference failed');
    if (fixture.mode === 'no_face') return undefined;
    const positions = Array.from({ length: 68 }, () => ({ x: 150, y: 150 }));
    positions[30] = { x: fixture.mode === 'away' ? 205 : 150, y: 155 };
    positions[8] = { x: 150, y: 250 };
    positions[36] = { x: 100, y: 100 }; positions[45] = { x: 200, y: 100 };
    positions[48] = { x: 120, y: 200 }; positions[54] = { x: 180, y: 200 };
    return { detection: { score: 0.99 }, landmarks: { positions } };
  } });
`;
const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { useFaceDetection } from '/src/hooks/useFaceDetection.ts';
  const h = React.createElement;
  function Fixture() {
    const [enabled, setEnabled] = React.useState(true);
    const state = useFaceDetection(enabled, {
      onViolation: kind => window.__face.violations.push(kind),
      onAutoSubmit: () => window.__face.autoSubmits++,
    });
    window.__face.setEnabled = setEnabled;
    return h('main', null,
      h('output', { id: 'status' }, state.status),
      h('button', { id: 'retry', onClick: state.retryCamera }, 'Retry'),
      h('video', { ref: state.videoRef, autoPlay: true, playsInline: true, muted: true }));
  }
  createRoot(document.getElementById('root')).render(h(React.StrictMode, null, h(Fixture)));
`;
const server = await createServer({ root, configFile: false,
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
  optimizeDeps: { exclude: ['face-api.js'] },
  plugins: [{ name: 'face-regression-fixture', enforce: 'pre',
    resolveId(id) {
      if (id === 'face-api.js') return '\0fixture-models';
      if (id === '/face-fixture.js') return '\0face-fixture.js';
    },
    load(id) {
      if (id === '\0fixture-models') return models;
      if (id === '\0face-fixture.js') return entry;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url !== '/face-regression') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<div id="root"></div><script type="module" src="/face-fixture.js"></script>');
      });
    },
  }],
});
await server.listen();
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__face = { modelFailure: true, modelLoads: 0, mode: 'valid', inferences: 0,
      inferenceFailure: false, violations: [], autoSubmits: 0, timeOffset: 0, cameraDelay: 0, cameraRequests: 0, streams: [] };
    const now = Date.now;
    Date.now = () => now() + window.__face.timeOffset;
    const request = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.__face.cameraRequests++;
      const stream = await request(constraints);
      window.__face.streams.push(stream);
      if (window.__face.cameraDelay) await new Promise(resolve => setTimeout(resolve, window.__face.cameraDelay));
      return stream;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4174/face-regression');
  const status = value => page.waitForFunction(expected => document.getElementById('status')?.textContent === expected, value);
  await status('model_load_failed');
  assert.equal(await page.evaluate(() => window.__face.modelLoads), 1);
  await page.evaluate(() => { window.__face.modelFailure = false; });
  await page.locator('#retry').click();
  await status('looking');
  assert.equal(await page.evaluate(() => window.__face.modelLoads), 2);
  console.log('PASS: StrictMode model load sharing, failed model retry, live synthetic webcam and positive inference');

  await page.evaluate(() => { window.__face.mode = 'no_face'; });
  await status('camera_ready');
  await page.evaluate(() => { window.__face.timeOffset += 3000; });
  await page.waitForFunction(() => window.__face.violations.length === 1);
  await page.evaluate(() => { window.__face.mode = 'away'; window.__face.timeOffset += 60000; });
  await page.waitForFunction(() => window.__face.autoSubmits === 1);
  assert.deepEqual(await page.evaluate(() => window.__face.violations), ['no_face']);
  console.log('PASS: missing face and turned-away results share one violation episode and one automatic submit');

  await page.evaluate(() => { window.__face.mode = 'valid'; });
  await status('looking');
  await page.evaluate(() => { window.__face.mode = 'away'; });
  await status('camera_ready');
  await page.evaluate(() => { window.__face.timeOffset += 3000; });
  await page.waitForFunction(() => window.__face.violations.length === 2);
  assert.deepEqual(await page.evaluate(() => window.__face.violations), ['no_face', 'face_away']);
  await page.evaluate(() => { window.__face.inferenceFailure = true; });
  await status('inference_error');
  assert.equal(await page.evaluate(() => window.__face.violations.length), 2);
  console.log('PASS: sustained face reacquisition resets the episode; inference failure remains an operational error');

  await page.evaluate(() => { window.__face.setEnabled(false); });
  await page.waitForFunction(() => window.__face.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
  const requests = await page.evaluate(() => window.__face.cameraRequests);
  await page.evaluate(() => { window.__face.cameraDelay = 500; window.__face.setEnabled(true); });
  await page.waitForFunction(previous => window.__face.cameraRequests > previous, requests);
  await page.evaluate(() => { window.__face.setEnabled(false); });
  await page.waitForFunction(previous => window.__face.streams.length > previous, requests);
  await page.waitForFunction(() => window.__face.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
  assert.deepEqual(errors, []);
  console.log('PASS: cancelled late webcam request releases tracks without replacing the current feed');
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
