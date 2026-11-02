// Exercises the built UI against actual local Express routes/controllers/services.
// Only Supabase storage is replaced with isolated in-memory rows. No real user,
// course, topic, enrollment, credential, AI service or database is modified.
// Build backend/frontend, start the frontend preview, then run from repo root.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

Object.assign(process.env, { NODE_ENV: 'test', VERCEL: '1',
  JWT_SECRET: 'isolated-enrolled-browser-secret-long-enough', SUPABASE_URL: 'https://fixture.invalid',
  SUPABASE_KEY: 'fixture-key', SUPABASE_SERVICE_KEY: 'fixture-key', FRONTEND_URL: 'http://127.0.0.1:4173',
  GEMINI_API_KEY: '', RESEND_API_KEY: '' });
const require = createRequire(path.resolve('backend/package.json'));
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { supabase } = require(path.resolve('backend/dist/src/config/supabase.js'));
const teacher = { id: 'teacher-1', name: 'Fixture Teacher', role: 'teacher', is_suspended: false };
const student = { id: 'student-1', name: 'Fixture Student', role: 'student', is_suspended: false };
const outsider = { id: 'student-2', name: 'Fixture Outsider', role: 'student', is_suspended: false };
const course = { id: 'private-course', title: 'Private enrolled course', description: 'Shared by course code',
  category: 'Other', difficulty: 'Beginner', created_by: teacher.id, is_published: false, max_students: 10 };
const rows = {
  users: [teacher, student, outsider].map(user => ({ ...user, email: `${user.id}@nutech.edu.pk` })),
  courses: [course], enrollments: [{ id: 'enrollment-1', user_id: student.id, course_id: course.id }],
  topics: [], questions: [],
};
supabase.from = table => {
  if (!rows[table]) throw new Error(`Unexpected fixture table: ${table}`);
  const filters = [], orders = [];
  let columns = '*', limit, written;
  const response = (start = 0, end = Infinity) => {
    const all = written || rows[table].filter(row => filters.every(filter => filter(row))).sort((a, b) => {
      for (const [key, ascending] of orders) {
        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
    let data = all.slice(start, Math.min(end + 1, limit ?? Infinity));
    if (table === 'enrollments' && columns.includes('courses(*)')) data = data.map(row => ({
      ...row, courses: rows.courses.find(course => course.id === row.course_id),
    }));
    return { data, count: all.length, error: null };
  };
  const query = {
    select: (value = '*') => { columns = value; return query; },
    eq: (key, value) => { filters.push(row => row[key] === value); return query; },
    in: (key, values) => { filters.push(row => values.includes(row[key])); return query; },
    order: (key, options = {}) => { orders.push([key, options.ascending !== false]); return query; },
    limit: value => { limit = value; return query; },
    insert: values => {
      written = values.map((value, index) => ({ ...value, id: `${table}-${rows[table].length + index + 1}` }));
      rows[table].push(...written);
      return query;
    },
    single: async () => ({ ...response(), data: response().data[0] || null }),
    maybeSingle: async () => ({ ...response(), data: response().data[0] || null }),
    range: async (start, end) => response(start, end),
    then: (resolve, reject) => Promise.resolve(response()).then(resolve, reject),
  };
  return query;
};
supabase.rpc = () => { throw new Error('Unexpected fixture RPC'); };
const { protect } = require(path.resolve('backend/dist/src/middleware/auth.js'));
const courseRoutes = require(path.resolve('backend/dist/src/routes/courses.js')).default;
const { errorHandler } = require(path.resolve('backend/dist/src/middleware/errorHandler.js'));
const app = express();
app.use(express.json(), cookieParser());
app.get('/api/auth/me', protect, (req, res) => {
  const user = rows.users.find(user => user.id === req.user._id);
  res.json({ success: true, data: { ...user, _id: user.id } });
});
app.get('/api/notifications', protect, (_req, res) => res.json({ success: true, data: [] }));
app.use('/api/courses', courseRoutes);
app.use(errorHandler);
const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
const apiBase = `http://127.0.0.1:${server.address().port}`;
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4173';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const output = path.resolve('backend/coverage/enrolled-topics-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const errors = [];
const topicReads = [];

async function session(user) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'eraedu_session', value: jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET), url: base }]);
  await context.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const fixtureUrl = `${apiBase}${url.pathname}${url.search}`;
    assert.ok(url.pathname.startsWith('/api/'), 'Only local API routes can reach the fixture server');
    const headers = await request.allHeaders();
    delete headers.host;
    const response = await fetch(fixtureUrl, { method: request.method(), headers, body: request.postDataBuffer() || undefined });
    const body = await response.text();
    if (url.pathname.endsWith('/topics') && request.method() === 'GET') topicReads.push({ user: user.id, status: response.status, body });
    await route.fulfill({ status: response.status, contentType: 'application/json', body });
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return context;
}

let report;
try {
  const teacherSession = await session(teacher);
  const studentSession = await session(student);
  const teacherPage = await teacherSession.newPage();
  const listPage = await studentSession.newPage();
  const detailPage = await studentSession.newPage();
  await listPage.goto(`${base}/dashboard/student/courses`);
  await listPage.getByText('0 topics', { exact: true }).waitFor();
  await detailPage.goto(`${base}/courses/${course.id}`);
  await detailPage.getByText('Your teacher has not added topics yet.', { exact: false }).waitFor();
  await teacherPage.goto(`${base}/dashboard/teacher/topics`);
  await teacherPage.getByRole('button', { name: 'Add Topic', exact: true }).click();
  const form = teacherPage.locator('form');
  await form.locator('input[type="text"]').fill('Teacher-selected private topic');
  await form.locator('textarea').fill('Private topic study notes added by the educator.');
  await form.locator('select').selectOption(course.id);
  await form.getByRole('button', { name: 'Create', exact: true }).click();
  await teacherPage.getByText('Teacher-selected private topic', { exact: true }).waitFor();
  assert.equal(rows.topics.length, 1, 'The actual teacher controller/service inserted the topic');
  assert.equal(rows.courses[0].is_published, false, 'Private material does not require public catalog publication');
  await listPage.bringToFront();
  await listPage.evaluate(() => window.dispatchEvent(new Event('focus')));
  await listPage.getByText('1 topics', { exact: true }).waitFor();
  await detailPage.bringToFront();
  await detailPage.evaluate(() => window.dispatchEvent(new Event('focus')));
  await detailPage.getByRole('heading', { name: 'Teacher-selected private topic', exact: true }).waitFor();
  await detailPage.getByRole('link', { name: 'Study', exact: true }).click();
  await detailPage.waitForURL(`${base}/courses/${course.id}/topics/${rows.topics[0].id}`);
  await detailPage.getByRole('heading', { name: 'Teacher-selected private topic', exact: true, level: 1 }).waitFor();
  await detailPage.getByText('Private topic study notes added by the educator.', { exact: true }).waitFor();
  await detailPage.screenshot({ path: path.join(output, 'enrolled-private-topic-study.png'), fullPage: true });
  const catalog = await detailPage.evaluate(async () => (await fetch('/api/courses')).json());
  assert.deepEqual(catalog.data, []);
  assert.ok(topicReads.some(read => read.user === student.id && read.status === 200 && read.body.includes(rows.topics[0].id)));
  const outsiderSession = await session(outsider);
  const outsiderPage = await outsiderSession.newPage();
  await outsiderPage.goto(`${base}/courses/${course.id}/topics/${rows.topics[0].id}`);
  await outsiderPage.getByText('You do not have access to this topic.', { exact: false }).waitFor();
  assert.equal(await outsiderPage.getByRole('heading', { name: 'Teacher-selected private topic', exact: true }).count(), 0);
  rows.enrollments.length = 0;
  await detailPage.reload();
  await detailPage.getByText('You do not have access to this topic.', { exact: false }).waitFor();
  assert.deepEqual(errors, []);
  report = { status: 'PASS', checks: ['actual teacher topic create', 'joined private-course count refresh',
    'open course topic refresh', 'study detail', 'private catalog exclusion', 'unenrolled and revoked access denial'] };
} catch (error) {
  for (const [contextIndex, context] of browser.contexts().entries()) {
    for (const [pageIndex, page] of context.pages().entries()) {
      await page.screenshot({ path: path.join(output, `failure-${contextIndex}-${pageIndex}.png`) }).catch(() => {});
    }
  }
  report = { status: 'FAIL', error: error.stack || String(error) };
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
