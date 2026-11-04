// Built UI + actual report service with isolated in-memory database fixtures.
// No production accounts, enrollments, marks or exam records are changed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4183';
const output = new URL('../backend/coverage/admin-learning-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const users = [
  { id: 'teacher-1', name: 'Dr Amina', email: 'amina@example.invalid', role: 'teacher' },
  { id: 'teacher-2', name: 'Bilal Khan', email: 'bilal@example.invalid', role: 'teacher' },
  { id: 'teacher-3', name: 'New Teacher', email: 'new@example.invalid', role: 'teacher' },
  { id: 'student-1', name: 'Sara Ahmed', email: 'sara@example.invalid', role: 'student' },
  { id: 'student-2', name: 'Ali Hassan', email: 'ali@example.invalid', role: 'student' },
];
const tables = {
  users,
  courses: [{ id: 'math', title: 'Algebra', created_by: 'teacher-1', is_published: false }, { id: 'biology', title: 'Biology', created_by: 'teacher-2', is_published: true }],
  enrollments: [{ id: 'enroll-1', user_id: 'student-1', course_id: 'math', enrolled_at: '2026-01-01' }, { id: 'enroll-2', user_id: 'student-2', course_id: 'math', enrolled_at: '2026-01-02' }, { id: 'enroll-3', user_id: 'student-1', course_id: 'biology', enrolled_at: '2026-02-01' }],
  teacher_quizzes: [{ id: 'mcq', title: 'Algebra MCQ', course_id: 'math', teacher_id: 'teacher-1' }, { id: 'written', title: 'Written test', course_id: 'math', teacher_id: 'teacher-1' }],
  topics: [{ id: 'cells', title: 'Cells', course_id: 'biology' }],
  quizzes: [{ id: 'topic-test', title: 'Cells topic test', topic_id: 'cells' }],
  quiz_attempts: [
    { id: 'zero', user_id: 'student-1', quiz_id: 'mcq', topic_id: null, status: 'completed', teacher_grade: 0, score: 1, max_score: 1, started_at: '2026-04-01', completed_at: '2026-04-01' },
    { id: 'pending', user_id: 'student-1', quiz_id: 'written', topic_id: null, status: 'completed', teacher_grade: null, score: 0, max_score: 1, started_at: '2026-04-02', completed_at: '2026-04-02' },
    { id: 'topic-result', user_id: 'student-1', quiz_id: 'topic-test', topic_id: 'cells', status: 'completed', teacher_grade: null, score: 1, max_score: 1, started_at: '2026-04-03', completed_at: '2026-04-03' },
  ],
};
let failure = false, calls = 0;
const supabasePath = require.resolve('./dist/src/config/supabase.js');
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: { supabase: {
  from: table => ({ select: () => ({ order: () => ({ range: async (start, end) => ({
    data: failure ? null : [...tables[table]].sort((a, b) => a.id.localeCompare(b.id)).slice(start, end + 1),
    error: failure ? { message: 'Fixture database unavailable' } : null,
  }) }) }) }),
} } };
const { adminLearningService } = require('./dist/src/services/adminLearningService.js');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
const admin = { _id: 'administrator', name: 'QA Admin', email: 'admin@example.invalid', role: 'admin' };
const unknown = [], errors = [], checks = [];
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/**', async route => {
  const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, '');
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
  if (endpoint === '/auth/me') return reply({ success: true, data: admin });
  if (endpoint === '/notifications') return reply({ success: true, data: [] });
  if (endpoint === '/admin/learning-activity') {
    calls++;
    try { return await reply({ success: true, data: await adminLearningService.getActivity() }); }
    catch (error) { return reply({ success: false, error: { message: error.message } }, 503); }
  }
  unknown.push(endpoint); return reply({ success: false }, 500);
});
try {
  await page.goto(base + '/dashboard/admin/analytics');
  await page.getByRole('heading', { name: 'Learning Analytics', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Teachers & courses' }).waitFor();
  const directory = page.getByRole('region', { name: 'Teachers & courses' });
  const roster = page.getByRole('region', { name: 'Students & joined courses' });
  assert.match(await directory.innerText(), /Dr Amina/); assert.match(await directory.innerText(), /Bilal Khan/);
  assert.match(await directory.innerText(), /New Teacher/); assert.match(await directory.innerText(), /No courses assigned/);
  assert.match(await roster.innerText(), /Ali Hassan/); assert.match(await roster.innerText(), /Sara Ahmed/);
  checks.push('Administrator with no personal exams sees teachers, courses, enrolled students and platform metrics');

  await directory.getByRole('button', { name: /^Algebra/ }).click();
  assert.doesNotMatch(await roster.innerText(), /Biology/);
  await roster.getByRole('button', { name: 'View tests for Ali Hassan in Algebra' }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /No test attempts yet/);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('Selecting teacher/course retains enrolled learners with no test attempts');

  await roster.getByRole('button', { name: 'View tests for Sara Ahmed in Algebra' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.match(await dialog.innerText(), /Algebra MCQ/); assert.match(await dialog.innerText(), /0%/);
  assert.match(await dialog.innerText(), /Awaiting review/); assert.doesNotMatch(await dialog.innerText(), /Cells topic test/);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  checks.push('Student test history preserves a grade of zero, pending review and course boundaries');

  await page.getByLabel('Teacher', { exact: true }).selectOption('teacher-2');
  assert.match(await roster.innerText(), /Biology/); assert.doesNotMatch(await roster.innerText(), /Algebra/);
  await roster.getByRole('button', { name: 'View tests for Sara Ahmed in Biology' }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Cells topic test/);
  assert.match(await page.getByRole('dialog').innerText(), /100%/);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('Topic tests appear under their current course teacher');

  await page.goto(base + '/dashboard/admin/submissions');
  await page.getByRole('region', { name: 'Test attempts', exact: true }).waitFor();
  const submissions = page.getByRole('region', { name: 'Test attempts', exact: true });
  assert.match(await submissions.innerText(), /Dr Amina/); assert.match(await submissions.innerText(), /Bilal Khan/);
  assert.match(await submissions.innerText(), /Algebra MCQ/); assert.match(await submissions.innerText(), /Cells topic test/);
  await page.getByLabel('Status', { exact: true }).selectOption('pending');
  assert.match(await submissions.innerText(), /Written test/); assert.doesNotMatch(await submissions.innerText(), /Algebra MCQ/);
  checks.push('Submissions list resolves names/courses for both test models and filters pending work');

  failure = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Administrator learning activity could not be loaded' }).waitFor();
  failure = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('heading', { name: 'Teachers & courses' }).waitFor();
  checks.push('Failed data loads show a retryable error and recover without fabricated zero counts');

  await page.getByLabel('Search', { exact: true }).fill('sara');
  assert.match(await roster.innerText(), /Sara Ahmed/); assert.doesNotMatch(await roster.innerText(), /Ali Hassan/);
  await page.getByLabel('Search', { exact: true }).fill('');
  await page.screenshot({ path: new URL('admin-submissions-desktop.png', output).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('#dashboard-sidebar').getBoundingClientRect().right <= 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page-level horizontal overflow');
  await page.screenshot({ path: new URL('admin-submissions-mobile.png', output).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true });
  checks.push('Search and mobile layout work with scrollable data tables');
  assert.equal(unknown.length, 0, 'No teacher-only report API is called by admin pages');
  assert.deepEqual(errors, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ status: 'passed', checks, reportRequests: calls }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, reportRequests: calls }, null, 2));
} finally { await browser.close(); }
