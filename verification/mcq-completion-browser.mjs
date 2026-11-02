// UI submission-flow regressions with every API request intercepted.
// Actual PostgreSQL scoring is separately covered by verify-mcq-completion-metrics.mjs.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve('backend/coverage/mcq-completion-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const student = { _id: 'fixture-student', name: 'Fixture Student', email: 'student@example.invalid', role: 'student' };
const attempt = 'fixture-completion-attempt', question = 'fixture-exam-q0';
const results = [];
const success = data => ({ success: true, data });

async function stat(page, label, value) {
  const node = page.getByText(label, { exact: true }).locator('..').locator('p').nth(1);
  await node.getByText(value, { exact: true }).waitFor();
  assert.equal(await node.textContent(), value);
}
for (const written of [false, true]) {
  const name = written ? 'written-completion-stays-pending' : 'mcq-submit-updates-pass-rate';
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
  await context.addInitScript(({ studentId, attemptId }) => {
    localStorage.setItem(`eraedu-feedback-submitted:${studentId}:${attemptId}`, 'true');
  }, { studentId: student._id, attemptId: attempt });
  let completed = false, selected;
  const writes = [], unknown = [], errors = [];
  const summary = () => ({
    totalQuizzes: written ? Number(completed) : 1 + Number(completed),
    avgScore: written ? null : completed ? 60 : 20,
    passRate: written ? null : completed ? 50 : 0,
    pendingReviews: written ? Number(completed) : 0,
    streakDays: 1,
    performanceData: written ? [] : [{ week: 'Exam 1', score: 20 }, ...(completed ? [{ week: 'Exam 2', score: 100 }] : [])],
  });
  await context.route('**/api/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const now = new Date().toISOString();
    if (endpoint === '/auth/me') return reply(success(student));
    if (endpoint === '/notifications') return reply(success([]));
    if (endpoint === '/quizzes/student/analytics') return reply(success(summary()));
    if (endpoint === '/analytics/dashboard') return reply(success({ ...summary(), averageScore: summary().avgScore, coursesEnrolled: 1, quizzesCompleted: summary().totalQuizzes }));
    if (endpoint === `/quizzes/attempt/${attempt}/active`) return reply(success({
      attemptId: attempt, status: completed ? 'completed' : 'in-progress', serverNow: now, savedAnswers: {}, questionStates: {},
      quiz: { _id: 'fixture-exam', title: 'Fixture completion exam', cameraMonitoring: false, timeLimit: 10, violationLimit: 99,
        questions: [{ _id: question, text: written ? 'Write your response' : 'Choose the right response',
          questionType: written ? 'shortAnswer' : 'multipleChoice', options: written ? [] : ['Right option', 'Wrong option'], difficulty: 'Easy', timeLimit: 600 }] },
    }));
    if (endpoint === `/quizzes/attempt/${attempt}/activate`) return reply(success({ status: 'in-progress', questionId: question,
      activatedAt: now, deadlineAt: new Date(Date.now() + 600000).toISOString(), serverNow: now }));
    if (endpoint === `/quizzes/attempt/${attempt}/answer`) {
      writes.push({ endpoint, body: request.postDataJSON() });
      selected = request.postDataJSON().selectedAnswer;
      return reply(success({ attemptId: attempt, status: 'in-progress', saved: true, serverNow: now }));
    }
    if (endpoint === `/quizzes/${attempt}/submit-all`) {
      writes.push({ endpoint, body: request.postDataJSON() });
      assert.equal(request.headers()['x-eraedu-account'], student._id);
      assert.equal(selected, written ? 'Written fixture response' : 0);
      completed = true;
      // Feedback remains behind teacher review; this aggregate metric fix
      // does not return answer keys or manual marks in the submission DTO.
      return reply(success({ status: 'completed', reviewPending: true }));
    }
    if (endpoint === `/quizzes/attempt/${attempt}/results`) return reply(success({ id: attempt, status: 'completed', completedAt: now,
      reviewPending: true, reviewStatus: 'pending', quiz: { title: 'Fixture completion exam', questions: [] } }));
    if (endpoint === `/quizzes/attempts/${attempt}/report-violation`) return reply(success({ violationId: 'fixture-monitoring-event', violationCount: 1,
      autoSubmitted: false, alreadySubmitted: false }));
    unknown.push(`${request.method()} ${endpoint}`);
    return reply({ success: false, message: 'Unexpected fixture request' }, 500);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${base}/dashboard/student`);
    await stat(page, 'Pass Rate', written ? 'Not released' : '0%');
    await page.goto(`${base}/quiz/take/${attempt}`);
    await page.getByRole('button', { name: 'Enter secure fullscreen', exact: true }).click();
    if (written) await page.getByPlaceholder('Type your answer here').fill('Written fixture response');
    else await page.getByRole('button', { name: /Right option/ }).click();
    await page.getByRole('button', { name: 'Submit (1/1)', exact: true }).click();
    await page.getByRole('heading', { name: 'Submission Received', exact: true }).waitFor();
    assert.equal(await page.getByText('Right option', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Back to Dashboard', exact: true }).click();
    await stat(page, 'Pass Rate', written ? 'Not released' : '50%');
    await stat(page, 'Average Score', written ? 'Not released' : '60%');
    await stat(page, 'Exams Completed', written ? '1' : '2');
    if (written) await page.getByRole('status').filter({ hasText: '1 exam result(s) await a final teacher grade.' }).waitFor();
    await page.goto(`${base}/analytics`);
    const passRate = page.getByText('Pass rate', { exact: true }).locator('..').locator('dd');
    await passRate.getByText(written ? 'No released results' : '50%', { exact: true }).waitFor();
    assert.equal(writes.filter(write => write.endpoint.endsWith('/submit-all')).length, 1);
    assert.deepEqual(writes.find(write => write.endpoint.endsWith('/submit-all')).body, { answers: [] });
    assert.deepEqual(unknown, []);
    assert.deepEqual(errors, []);
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.stack?.slice(0, 1800) || String(error) });
    await page.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); }
  console.log(JSON.stringify(results.at(-1)));
}
await browser.close();
const summary = { scope: 'Intercepted UI fixtures; no real accounts, attempts, teacher-grade writes or database writes',
  passed: results.filter(result => result.status === 'PASS').length, failed: results.filter(result => result.status === 'FAIL').length, results };
await writeFile(path.join(output, 'local.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }));
if (summary.failed) process.exitCode = 1;
