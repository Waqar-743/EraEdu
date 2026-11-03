// Actual application routes, bundled model weights and photo/blank video frames.
// API responses are fixtures; no real accounts, webcam or database are accessed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(path.join(repo, 'frontend'));
const image = await readFile(path.join(repo, 'verification/fixtures/astronaut.jpg'));
const server = await createServer({ root: path.join(repo, 'frontend'),
  cacheDir: path.join(repo, 'frontend/node_modules/.vite-real-face-verification'),
  optimizeDeps: { force: true },
  configFile: path.join(repo, 'frontend/vite.config.ts'),
  server: { host: '127.0.0.1', port: 4183, strictPort: true },
  plugins: [{ name: 'real-model-verification',
    resolveId(id) { if (id === '/__expose-models.js') return '\0expose-models.js'; },
    load(id) { if (id === '\0expose-models.js') return "import * as faceapi from 'face-api.js'; window.__faceapi = faceapi;"; },
    transformIndexHtml() { return [{ tag: 'script', attrs: { type: 'module', src: '/__expose-models.js' }, injectTo: 'head' }]; },
  }],
});
await server.listen();
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const student = { _id: 'fixture-student', role: 'student', name: 'Camera Fixture', email: 'camera@example.invalid' };
const question = { _id: 'fixture-question', text: 'Monitoring question', content: 'Monitoring question',
  options: ['First', 'Second'], difficulty: 'Easy', timeLimit: 600, remainingSeconds: 600 };
try {
  for (const topic of [false, true]) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const reports = [], unexpected = [], errors = [];
    const attempt = topic ? 'fixture-topic-attempt' : 'fixture-code-attempt';
    const success = data => ({ success: true, data });
    await context.route('**/__camera-fixture.jpg', route => route.fulfill({ contentType: 'image/jpeg', body: image }));
    await context.route('**/api/**', async route => {
      const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
      const reply = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(success(data)) });
      if (endpoint === '/auth/me') return reply(student);
      if (endpoint === '/notifications') return reply([]);
      if (endpoint === `/quizzes/attempt/${attempt}/active`) return reply({ attemptId: attempt, status: 'in-progress',
        serverNow: new Date().toISOString(), savedAnswers: {}, questionStates: {}, quiz: { _id: 'fixture-quiz',
          title: 'Real model camera test', timeLimit: 10, cameraMonitoring: true, violationLimit: 99, questions: [question] } });
      if (endpoint === `/quizzes/attempt/${attempt}/activate`) return reply({ status: 'in-progress', questionId: question._id,
        activatedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + 600000).toISOString(), serverNow: new Date().toISOString() });
      if (endpoint === `/quizzes/topic-attempt/${attempt}/current`) return reply({ question, isComplete: false });
      if (endpoint === `/quizzes/attempts/${attempt}/report-violation`) {
        const event = request.postDataJSON(); reports.push(event);
        return reply({ violationId: event.event_id, violationCount: reports.length, autoSubmitted: false, alreadySubmitted: false });
      }
      unexpected.push(`${request.method()} ${endpoint}`);
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await context.addInitScript(() => {
      window.__cameraMode = 'face';
      window.__cameraStreams = [];
      navigator.mediaDevices.getUserMedia = async () => {
        const photo = new Image(); photo.src = '/__camera-fixture.jpg'; await photo.decode();
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        const draw = () => {
          ctx.fillStyle = '#444'; ctx.fillRect(0, 0, 640, 480);
          if (window.__cameraMode === 'face') ctx.drawImage(photo, 120, 0, 240, 300, 128, 0, 384, 480);
        };
        draw();
        const timer = setInterval(draw, 80);
        const stream = canvas.captureStream(12);
        stream.getTracks().forEach(track => track.addEventListener('ended', () => clearInterval(timer)));
        window.__cameraStreams.push(stream);
        return stream;
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') console.log(message.text()); });
    try {
      await page.goto(`http://127.0.0.1:4183${topic ? `/quiz/fixture-quiz/attempt/${attempt}` : `/quiz/take/${attempt}`}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log(`Loaded ${topic ? 'topic' : 'code'} exam fixture`);
      if (!topic) await page.getByRole('button', { name: 'Enter secure fullscreen', exact: true }).click();
      await Promise.race([
        page.getByText('Face detected ✓', { exact: true }).waitFor(),
        page.getByText('Detection unavailable', { exact: true }).waitFor().then(() => { throw new Error('Initial inference failed'); }),
      ]);
      // This proves real positive detection and landmarks, rather than only
      // blank-frame output or stubbed detector promises.
      await page.evaluate(() => { window.__cameraMode = 'blank'; });
      await page.getByText('No face detected!', { exact: true }).waitFor();
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.startsWith('eraedu:integrity:')));
      assert.equal(reports.filter(event => event.violation_type === 'no_face').length, 1);
      assert.equal(reports.find(event => event.violation_type === 'no_face').detectionMethod, 'camera_face_detection');
      await page.evaluate(() => { window.__cameraMode = 'face'; });
      await page.getByText('Face detected ✓', { exact: true }).waitFor();
      await page.evaluate(() => { window.__cameraMode = 'blank'; });
      await page.getByText('No face detected!', { exact: true }).waitFor();
      await page.waitForFunction(() => !Object.keys(localStorage).some(key => key.startsWith('eraedu:integrity:')));
      assert.equal(reports.filter(event => event.violation_type === 'no_face').length, 2);

      // Exercise a rejection from the real library object. The old composable
      // task swallowed this and hung forever; the direct Promise path recovers.
      await page.evaluate(() => {
        const net = window.__faceapi.nets.tinyFaceDetector;
        window.__originalLocate = net.locateFaces;
        net.locateFaces = async () => { throw new Error('Fixture GPU failure'); };
      });
      await page.getByText('Detection unavailable', { exact: true }).waitFor();
      const before = reports.filter(event => event.violation_type === 'no_face').length;
      await page.evaluate(() => { window.__faceapi.nets.tinyFaceDetector.locateFaces = window.__originalLocate; window.__cameraMode = 'face'; });
      await page.getByRole('button', { name: /Retry/ }).click();
      await page.getByText('Face detected ✓', { exact: true }).waitFor();
      assert.equal(reports.filter(event => event.violation_type === 'no_face').length, before);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(errors, []);
      console.log(`PASS: ${topic ? 'topic' : 'code'} exam, real models/photo -> blank -> persisted camera report -> reacquisition -> rejection/retry`);
    } catch (error) {
      console.log('Real-model failure diagnostics:', await page.evaluate(async () => {
        const video = document.querySelector('video');
        const state = { text: document.body.innerText.slice(0, 1800), video: video && { width: video.videoWidth, height: video.videoHeight, ready: video.readyState, paused: video.paused } };
        try {
          const api = window.__faceapi;
          const detections = await api.nets.tinyFaceDetector.locateFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }));
          state.scores = detections.map(detection => detection.score);
          if (detections[0]) {
            const faces = await api.extractFaces(video, [detections[0]]);
            const landmarks = await api.nets.faceLandmark68Net.detectLandmarks(faces[0]);
            const pts = (Array.isArray(landmarks) ? landmarks[0] : landmarks).positions;
            state.points = [8, 30, 36, 45, 48, 54].map(index => [index, pts[index].x, pts[index].y]);
          }
        } catch (error) { state.error = error.stack; }
        return state;
      }));
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); await server.close(); }
