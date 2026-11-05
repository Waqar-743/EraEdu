// Local built UI with intercepted fixture APIs. No accounts or database writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const root = fileURLToPath(new URL('../frontend/coverage/theme-build/', import.meta.url));
const output = fileURLToPath(new URL('../frontend/coverage/theme-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let target = path.resolve(root, '.' + name);
  if (path.relative(root, target).startsWith('..')) { res.writeHead(403).end(); return; }
  let data;
  try { data = await readFile(target); }
  catch { target = path.join(root, 'index.html'); data = await readFile(target); }
  res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }); res.end(data);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const checks = [], errors = [], unexpected = [];
const course = { _id: 'theme-course', title: 'Algebra foundations', description: 'Understand equations and practise mathematical reasoning.', category: 'Mathematics', difficulty: 'Beginner', topicsCount: 3, topics: ['one', 'two', 'three'], progress: 45, enrollmentCount: 12, assignedTeacherName: 'Amina Khan', assignedTeacherEmail: 'amina@example.invalid', createdBy: 'theme-teacher', maxStudents: 30, isPublished: true };
const style = (locator, property) => locator.evaluate((el, name) => getComputedStyle(el)[name], property);

try {
  for (const role of ['student', 'teacher', 'admin']) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('eraedu-display-preferences', JSON.stringify({ state: { theme: value, sidebarCollapsed: false }, version: 0 })), theme);
      await context.route('**/api/**', route => {
        const url = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        const reply = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, pagination: { page: 1, total: 1, totalPages: 1, limit: 50 } }) });
        if (url === '/auth/me') return reply({ _id: `theme-${role}`, name: 'Theme review', email: `${role}@example.invalid`, role });
        if (url === '/notifications') return reply([]);
        if (url === '/quizzes/student/analytics') return reply({ totalQuizzes: 3, avgScore: 76.8, passRate: 66.7, pendingReviews: 0, streakDays: 3, performanceData: [{ week: 'Week 1', score: 64 }, { week: 'Week 2', score: 76 }, { week: 'Week 3', score: 82 }, { week: 'Week 4', score: 85 }] });
        if (url === '/analytics/teacher/stats') return reply({ totalCourses: 1, totalStudents: 12, totalQuestions: 18, totalTopics: 3, avgStudentScore: 74.6, passRate: 75, pendingReviews: 2, activeEnrollments: 12 });
        if (url === '/analytics/teacher/course-performance') return reply([{ courseName: course.title, avgScore: 74.6, completionRate: 66.7, enrollments: 12 }]);
        if (url === '/analytics/teacher/recent-activity') return reply([{ id: 'theme-activity', type: 'submission', text: 'A learner submitted the Algebra foundations assessment.', occurredAt: '2026-11-04T10:30:00.000Z', href: '/dashboard/teacher/submissions' }]);
        if (url === '/admin/overview') return reply({ users: 14, courses: 1, quizzes: 2, attempts: 12, violations: 1, suspendedUsers: 0, roles: { student: 12, teacher: 1, admin: 1, unknown: 0 }, roleTotal: 14 });
        if (url === '/admin/feedback') return reply([{ id: 'theme-feedback', rating: 4, category: 'Assessment experience', liked: 'The exam instructions were clear.', improvements: 'Include another practice question before the timed exam.', would_recommend: true, created_at: '2026-11-04T11:00:00.000Z', users: { name: 'Sara Ahmed', email: 'sara@example.invalid' }, teacher_quizzes: { title: 'Algebra checkpoint' } }]);
        if (url === '/admin/integrity-events') return reply([{ id: 'theme-event', attemptId: 'theme-attempt', type: 'tab_switch', timestamp: '2026-11-04T10:25:00.000Z', severity: 'low', detectionMethod: 'browser_visibility', studentName: 'Sara Ahmed', studentEmail: 'sara@example.invalid', assessment: 'Algebra checkpoint', course: course.title, flagged: true, reviewed: false }]);
        if (['/courses/my/enrolled', '/courses/teacher/my-courses', '/admin/courses'].includes(url)) return reply([course]);
        if (url === '/admin/course-options') return reply({ organizations: [], teachers: [] });
        unexpected.push(url); return route.fulfill({ status: 500, body: '{}' });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(`${role}/${theme}: ${error.message}`));
      await page.goto(base + '/');
      const landingHeading = page.locator('h1');
      await landingHeading.waitFor();
      const landingFont = await style(page.locator('.app-theme'), 'fontFamily');
      const displayFont = await style(landingHeading, 'fontFamily');
      const loadedFonts = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replaceAll('"', ''));
      });
      assert.ok(loadedFonts.includes('Plus Jakarta Sans'), `The shared body font actually loads: ${JSON.stringify(loadedFonts)}`);
      assert.ok(loadedFonts.includes('Clash Display'), `The shared heading font actually loads: ${JSON.stringify(loadedFonts)}`);
      const landingText = await style(landingHeading, 'color');
      assert.match(landingFont, /Plus Jakarta Sans/);
      assert.match(displayFont, /Clash Display/);
      assert.equal(landingText, 'rgb(6, 78, 59)', 'Landing ignores workspace display preference');
      const landingButton = page.getByRole('link', { name: 'Get started', exact: true });
      assert.equal(await style(landingButton, 'backgroundColor'), 'rgb(4, 120, 87)');
      await page.goto(`${base}/dashboard/${role}`);
      const overviewHeading = page.locator('#dashboard-content h1');
      await overviewHeading.waitFor();
      assert.equal(await style(page.locator('.app-workspace'), 'fontFamily'), landingFont);
      assert.equal(await style(overviewHeading, 'fontFamily'), displayFont);
      assert.equal(await style(overviewHeading, 'color'), 'rgb(255, 255, 255)', `${role}/${theme}: hero headings retain their white foreground`);
      if (role !== 'admin') await page.locator('#dashboard-content .recharts-surface').first().waitFor();
      await page.screenshot({ path: path.join(output, `${role}-${theme}-overview.png`), fullPage: true });
      checks.push(`${role}/${theme}: overview shared fonts and contrast-safe hero heading`);
      await page.goto(`${base}/dashboard/${role}/courses`);
      await page.locator('#dashboard-content').waitFor();
      await page.getByText(course.title, { exact: true }).first().waitFor();
      const workspace = page.locator('.app-workspace');
      assert.equal(await style(workspace, 'fontFamily'), landingFont);
      assert.equal(await style(page.locator('h1'), 'fontFamily'), displayFont);
      assert.equal(await style(page.locator('h1'), 'color'), theme === 'dark' ? 'rgb(230, 244, 239)' : landingText);

      // Exercise compiled utilities in a real workspace. In particular, a hover
      // token must not override the resting colour merely because it is present.
      await workspace.evaluate(el => {
        const probe = document.createElement('button');
        probe.id = 'theme-probe'; probe.textContent = 'Theme state check';
        probe.className = 'bg-primary-700 hover:bg-primary-800 focus:ring-2 focus:ring-primary-500 text-white';
        probe.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100;padding:12px';
        el.append(probe);
      });
      const probe = page.locator('#theme-probe');
      assert.equal(await style(probe, 'backgroundColor'), 'rgb(4, 120, 87)');
      assert.equal(await style(probe, 'color'), 'rgb(255, 255, 255)');
      await probe.hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#theme-probe')).backgroundColor === 'rgb(6, 95, 70)');
      assert.equal(await style(probe, 'backgroundColor'), 'rgb(6, 95, 70)');
      await probe.focus();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#theme-probe')).boxShadow.includes('16, 185, 129'));
      assert.match(await style(probe, 'boxShadow'), /16, 185, 129/);
      await probe.evaluate(el => el.remove());
      await page.mouse.move(0, 0);
      await workspace.evaluate(el => {
        const link = document.createElement('a');
        link.id = 'theme-link'; link.textContent = 'Theme link check'; link.href = '#';
        link.className = 'text-primary-700 hover:text-primary-900 bg-primary-50/60';
        link.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100;padding:12px';
        el.append(link);
      });
      const link = page.locator('#theme-link');
      assert.equal(await style(link, 'color'), theme === 'dark' ? 'rgb(108, 232, 183)' : 'rgb(4, 120, 87)');
      await link.hover();
      await page.waitForFunction(dark => getComputedStyle(document.querySelector('#theme-link')).color === (dark ? 'rgb(108, 232, 183)' : 'rgb(6, 78, 59)'), theme === 'dark');
      await link.evaluate(el => el.remove());
      const primaryAction = page.getByRole(role === 'student' ? 'button' : 'link', { name: role === 'student' ? 'Join Course' : 'Create Course', exact: true });
      assert.equal(await style(primaryAction, 'backgroundColor'), 'rgb(4, 120, 87)');
      assert.equal(await style(primaryAction, 'color'), 'rgb(255, 255, 255)');
      if (role === 'student') {
        await primaryAction.click();
        const input = page.getByPlaceholder('e.g. AB3K7X');
        await input.waitFor();
        assert.match(await style(input, 'fontFamily'), /monospace/, 'Exam codes keep their intentional monospaced font');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.keyboard.press('Escape');
      }
      await page.screenshot({ path: path.join(output, `${role}-${theme}-desktop.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.querySelector('#dashboard-sidebar').getBoundingClientRect().right <= 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role}/${theme}: no mobile overflow`);
      await page.screenshot({ path: path.join(output, `${role}-${theme}-mobile.png`) });
      checks.push(`${role}/${theme}: shared fonts, heading/CTA colours, hover/focus, desktop/mobile`);
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors, unexpected }, null, 2));
  console.log(JSON.stringify({ checks, errors, unexpected }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
