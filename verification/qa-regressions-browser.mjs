// Intercepted fixtures only. No real accounts, grades, enrollments or passwords
// are changed. Run against a built local preview on 127.0.0.1:4173.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve('backend/coverage/qa-regressions-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const student = { _id: 'fixture-student', name: 'Fixture Student', email: 'student@example.invalid', role: 'student' };
const course = { _id: 'fixture-course', title: 'Fixture course', description: 'A course used only by this test',
  category: 'Computer Science', difficulty: 'Beginner', topicsCount: 0, topics: [], isEnrolled: true, canViewTopics: true };
const topic = { _id: 'fixture-topic', courseId: course._id, title: 'New educator topic', description: 'Published after the learner opens the page', order: 1 };
const success = data => ({ success: true, data });

async function scenario(name, user, handler, run) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const unknown = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint === '/auth/me') return user ? reply(success(user)) : reply({ success: false }, 401);
    if (endpoint === '/notifications') return reply(success([]));
    if (await handler({ endpoint, request, reply })) return;
    unknown.push(`${request.method()} ${endpoint}`);
    return reply({ success: false, message: 'Unexpected fixture request' }, 500);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await run(page);
    assert.deepEqual(unknown, []);
    assert.deepEqual(errors, []);
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.stack?.slice(0, 1600) || String(error) });
    await page.screenshot({ path: path.join(output, `${name}.png`) }).catch(() => {});
  } finally { await context.close(); }
  console.log(JSON.stringify(results.at(-1)));
}

try {
  await scenario('registration-password-and-clipboard', null, async () => false, async page => {
    await page.goto(`${base}/register`);
    const input = page.locator('#password');
    await input.fill('FixturePassword123');
    assert.equal(await input.getAttribute('type'), 'password');
    await page.getByRole('button', { name: 'Show password', exact: true }).first().click();
    assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await input.inputValue(), 'FixturePassword123');
    assert.equal(await input.evaluate(element => ['copy', 'paste'].every(type =>
      element.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true })))), true);
    await page.evaluate(() => navigator.clipboard.writeText('PastedFixture123'));
    await input.focus();
    await input.press('Control+A');
    await input.press('Control+V');
    assert.equal(await input.inputValue(), 'PastedFixture123');
    await input.press('Control+A');
    await input.press('Control+C');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'PastedFixture123');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    assert.equal(await input.getAttribute('type'), 'password');
    await page.locator('#confirmPassword').fill('PastedFixture123');
    await page.getByRole('button', { name: 'Show password', exact: true }).last().click();
    assert.equal(await page.locator('#confirmPassword').getAttribute('type'), 'text');
  });

  let rejectPassword = true;
  const passwordWrites = [];
  await scenario('settings-theme-sidebar-and-password', { ...student, role: 'teacher' }, async ({ endpoint, request, reply }) => {
    if (endpoint === '/auth/change-password') {
      passwordWrites.push(request.postDataJSON());
      await reply(rejectPassword ? { success: false, error: { message: 'Current password is incorrect.' } } : success({ message: 'Password changed' }), rejectPassword ? 400 : 200);
      return true;
    }
  }, async page => {
    await page.goto(`${base}/settings`);
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await page.getByRole('radio', { name: 'Dark', exact: true }).check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('radio', { name: 'Collapsed', exact: true }).check();
    await page.screenshot({ path: path.join(output, 'settings-dark.png'), fullPage: true });
    await page.reload();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Dark', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('radio', { name: 'Collapsed', exact: true }).isChecked(), true);
    assert.equal(Math.round((await page.locator('#dashboard-sidebar').boundingBox()).width), 96);
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await page.getByRole('radio', { name: 'Expanded', exact: true }).check();
    await page.getByRole('radio', { name: 'Light', exact: true }).check();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.ok(await page.getByRole('link', { name: 'Courses', exact: true }).getAttribute('href') === '/dashboard/teacher/courses');
    await page.locator('#current-password').fill('FixtureOld123');
    await page.locator('#new-password').fill('FixtureNew123');
    await page.locator('#confirm-password').fill('FixtureNew123');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Current password is incorrect.' }).waitFor();
    rejectPassword = false;
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await page.getByText('Your password has been changed.', { exact: true }).waitFor();
    assert.equal(await page.locator('#current-password').inputValue(), '');
    assert.deepEqual(passwordWrites, Array(2).fill({ currentPassword: 'FixtureOld123', newPassword: 'FixtureNew123' }));
  });

  let userRequests = 0;
  await scenario('admin-separated-user-governance', { ...student, role: 'admin' }, async ({ endpoint, reply }) => {
    if (endpoint === '/admin/overview') {
      await reply(success({ users: 1, courses: 0, quizzes: 0, attempts: 0, violations: 0, suspendedUsers: 0,
        roles: { student: 0, teacher: 0, admin: 1 }, roleTotal: 1 })); return true;
    }
    if (endpoint === '/admin/feedback' || endpoint === '/admin/integrity-events') { await reply(success([])); return true; }
    if (endpoint === '/admin/users') {
      userRequests++;
      await reply({ ...success([{ ...student, role: 'admin', created_at: new Date().toISOString(), is_suspended: false }]), pagination: { total: 1 } });
      return true;
    }
  }, async page => {
    await page.goto(`${base}/dashboard/admin`);
    await page.getByText('Registered users', { exact: true }).waitFor();
    assert.equal(await page.locator('#user-governance').count(), 0);
    assert.equal(userRequests, 0);
    await page.getByRole('link', { name: 'User Governance', exact: true }).click();
    await page.locator('#user-governance').waitFor();
    await page.locator('#user-governance').getByText(student.email, { exact: true }).waitFor();
    assert.ok(userRequests > 0);
  });

  let enrolled = false, count = 0, listRequests = 0;
  await scenario('learner-join-and-live-count', student, async ({ endpoint, request, reply }) => {
    if (endpoint === '/courses/my/enrolled') {
      listRequests++;
      await reply(success(enrolled ? [{ ...course, topicsCount: count }] : [])); return true;
    }
    if (endpoint === '/courses/join-by-code') {
      assert.deepEqual(request.postDataJSON(), { courseCode: 'ABC123' });
      enrolled = true;
      await reply(success({ isEnrolled: true, message: 'Enrolled successfully!' })); return true;
    }
  }, async page => {
    await page.goto(`${base}/dashboard/student/courses`);
    await page.getByRole('heading', { name: 'No Courses Yet', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /join|enter code/i }).count(), 1);
    await page.getByRole('button', { name: 'Join Course', exact: true }).click();
    await page.getByPlaceholder('e.g. AB3K7X').fill('abc123');
    await page.getByRole('button', { name: 'Join Course', exact: true }).last().click();
    await page.getByRole('heading', { name: course.title, exact: true }).waitFor();
    await page.getByText('0 topics', { exact: true }).waitFor();
    count = 2;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText('2 topics', { exact: true }).waitFor();
    // The timer also refreshes a page that remains open and visible.
    count = 3;
    await page.getByText('3 topics', { exact: true }).waitFor({ timeout: 20000 });
    assert.ok(listRequests >= 4);
    assert.equal(await page.getByRole('button', { name: /join|enter code/i }).count(), 1);
  });

  let topics = [], canViewTopics = true, failTopics = false, denyCourse = false;
  await scenario('learner-live-topics-and-access', student, async ({ endpoint, reply }) => {
    if (endpoint === `/courses/${course._id}`) {
      await reply(denyCourse ? { success: false, message: 'Fixture course access revoked' } : success({ ...course, canViewTopics }), denyCourse ? 403 : 200);
      return true;
    }
    if (endpoint === `/courses/${course._id}/topics`) {
      await reply(failTopics ? { success: false, message: 'Fixture topic service unavailable' } : success(topics), failTopics ? 503 : 200);
      return true;
    }
  }, async page => {
    await page.goto(`${base}/courses/${course._id}`);
    await page.getByText('Your teacher has not added topics yet.', { exact: false }).waitFor();
    topics = [topic];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', { name: topic.title, exact: true }).waitFor();
    failTopics = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alert').filter({ hasText: 'Fixture topic service unavailable' }).waitFor();
    failTopics = false;
    topics = [{ ...topic, title: 'Updated educator topic' }];
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('heading', { name: 'Updated educator topic', exact: true }).waitFor();
    canViewTopics = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText('Topics are available after you enroll', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Study', exact: true }).count(), 0);
    canViewTopics = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', { name: 'Updated educator topic', exact: true }).waitFor();
    denyCourse = true;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByText('Fixture course access revoked', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Study', exact: true }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Updated educator topic', exact: true }).count(), 0);
  });

  let releaseEnrollment;
  const enrollmentGate = new Promise(resolve => { releaseEnrollment = resolve; });
  let startedEnrollment;
  const enrollmentStarted = new Promise(resolve => { startedEnrollment = resolve; });
  let courseAReads = 0;
  await scenario('enrollment-does-not-replace-another-course', student, async ({ endpoint, reply }) => {
    if (endpoint === '/courses/course-a') {
      courseAReads++;
      await reply(success({ ...course, _id: 'course-a', title: 'Course A', isEnrolled: false, canViewTopics: false })); return true;
    }
    if (endpoint === '/courses/course-b') {
      await reply(success({ ...course, _id: 'course-b', title: 'Course B', isEnrolled: false, canViewTopics: false })); return true;
    }
    if (endpoint === '/courses/course-a/enroll') {
      startedEnrollment();
      await enrollmentGate;
      await reply(success({ isEnrolled: true })); return true;
    }
  }, async page => {
    await page.goto(`${base}/courses/course-a`);
    await page.getByRole('button', { name: 'Enroll Now', exact: true }).click();
    await enrollmentStarted;
    // Emulate SPA history traversal while an enrollment response is in flight.
    await page.evaluate(() => {
      history.pushState(null, '', '/courses/course-b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByRole('heading', { name: 'Course B', exact: true }).waitFor();
    const response = page.waitForResponse(result => result.url().endsWith('/courses/course-a/enroll'));
    releaseEnrollment();
    await response;
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.getByRole('heading', { name: 'Course B', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enroll Now', exact: true }).isEnabled(), true);
    assert.equal(courseAReads, 1);
  });

  const reports = [];
  await scenario('exam-immediate-hidden-tab-report', student, async ({ endpoint, request, reply }) => {
    const now = new Date().toISOString();
    if (endpoint === '/quizzes/attempt/fixture-attempt/active') {
      await reply(success({ attemptId: 'fixture-attempt', status: 'in-progress', serverNow: now,
        savedAnswers: {}, questionStates: {}, quiz: { _id: 'fixture-exam', title: 'Monitoring fixture', description: '',
          timeLimit: 10, cameraMonitoring: false, violationLimit: 99,
          questions: [{ _id: 'fixture-question', text: 'Which option?', options: ['First', 'Second'], difficulty: 'Easy', timeLimit: 600 }] } }));
      return true;
    }
    if (endpoint === '/quizzes/attempt/fixture-attempt/activate') {
      await reply(success({ status: 'in-progress', questionId: 'fixture-question', activatedAt: now,
        deadlineAt: new Date(Date.now() + 600000).toISOString(), serverNow: now })); return true;
    }
    if (endpoint === '/quizzes/attempts/fixture-attempt/report-violation') {
      reports.push(request.postDataJSON());
      await reply(success({ violationId: `fixture-event-${reports.length}`, violationCount: reports.length,
        autoSubmitted: false, alreadySubmitted: false })); return true;
    }
  }, async page => {
    await page.goto(`${base}/quiz/take/fixture-attempt`);
    await page.getByRole('button', { name: 'Enter secure fullscreen', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')]
      .some(button => button.textContent?.includes('First') && !button.disabled));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const until = Date.now() + 5000;
    while (!reports.some(report => report.violation_type === 'tab_change') && Date.now() < until) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(reports.filter(report => report.violation_type === 'tab_change').length, 1);
    assert.equal(await page.evaluate(() => document.visibilityState), 'hidden');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(reports.filter(report => report.violation_type === 'tab_change').length, 1);
  });
} finally { await browser.close(); }
const summary = { scope: 'Intercepted browser fixtures; no live account/database writes or webcam accuracy certification',
  passed: results.filter(result => result.status === 'PASS').length,
  failed: results.filter(result => result.status === 'FAIL').length, results };
await writeFile(path.join(output, 'local.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }));
if (summary.failed) process.exitCode = 1;
