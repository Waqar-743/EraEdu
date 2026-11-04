// Verify computed colors in the actual built forms and launch workflow.
// All account/API responses are isolated fixtures; no production writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4183';
const output = new URL('../backend/coverage/primary-colors-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const filePath = name => new URL(name, output).pathname.replace(/^\/([A-Z]:)/, '$1');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
let authenticated = false;
const user = { _id: 'teacher', name: 'Palette Teacher', email: 'teacher@example.invalid', role: 'teacher' };
const quiz = { _id: 'palette-exam', title: 'Palette exam', description: '', courseId: 'course', courseTitle: 'Palette course', timeLimit: 1, accessCode: '1234', createdAt: '2026-01-01', cameraMonitoring: true, questions: [{ text: 'Choose one', options: ['A', 'B'], correctAnswer: 0, difficulty: 'Easy', timeLimit: 60 }] };
const unknown = [], errors = [], checks = [];
const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
  if (path === '/auth/me') return authenticated ? reply({ success: true, data: user }) : reply({ success: false, error: { code: 'AUTH_REQUIRED' } }, 401);
  if (path === '/notifications') return reply({ success: true, data: [] });
  if (path === '/quizzes/teacher/my-quizzes') return reply({ success: true, data: [quiz] });
  if (path === '/courses/teacher/my-courses') return reply({ success: true, data: [{ _id: 'course', title: 'Palette course' }] });
  if (path === '/courses/teacher/questions') return reply({ success: true, data: [] });
  unknown.push(`${route.request().method()} ${path}`); return reply({ success: false }, 500);
});
const style = locator => locator.evaluate(node => { const css = getComputedStyle(node); return { color: css.color, background: css.backgroundColor, gradient: css.backgroundImage, accent: css.accentColor, borderTop: css.borderTopColor }; });
const solidPrimary = async locator => {
  const css = await style(locator);
  assert.equal(css.background, 'rgb(4, 120, 87)'); assert.equal(css.color, 'rgb(255, 255, 255)'); return css;
};
try {
  await page.goto(base + '/login'); await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await solidPrimary(page.getByRole('button', { name: 'Sign in', exact: true }));
  await page.goto(base + '/forgot-password');
  await solidPrimary(page.locator('button[type="submit"]'));
  checks.push('Login and password recovery use primary-green actions with white text');

  authenticated = true;
  await page.goto(base + '/dashboard/teacher/quizzes');
  await page.getByRole('heading', { name: 'My Exams', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create Exam', exact: true }).click();
  await solidPrimary(page.getByRole('button', { name: 'Create Exam', exact: true }).last());
  assert.equal((await style(page.locator('#cameraMonitoring'))).accent, 'rgb(4, 120, 87)');
  assert.equal((await style(page.locator('input[type="radio"]').first())).accent, 'rgb(4, 120, 87)');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  checks.push('Exam form actions, native checkboxes and answer radios use the primary palette');

  await page.getByText('Palette exam', { exact: true }).click();
  const modal = page.getByRole('dialog'); await modal.waitFor();
  const open = modal.getByRole('button', { name: 'Open Exam', exact: true });
  assert.equal(await open.isDisabled(), true);
  await modal.getByRole('checkbox').check();
  await open.evaluate(node => new Promise(resolve => {
    const settled = () => !node.disabled && getComputedStyle(node).color === 'rgb(255, 255, 255)'
      ? resolve() : requestAnimationFrame(settled);
    settled();
  }));
  const openStyle = await style(open);
  assert.match(openStyle.gradient, /rgb\(4, 120, 87\)/); assert.equal(openStyle.color, 'rgb(255, 255, 255)');
  await open.click();
  const proceed = modal.getByRole('button', { name: 'Continue', exact: true }); await proceed.waitFor();
  assert.match((await style(proceed)).gradient, /rgb\(4, 120, 87\)/);
  await proceed.click();
  const spinner = modal.locator('.animate-spin').first(); await spinner.waitFor();
  assert.equal((await style(spinner)).borderTop, 'rgb(5, 150, 105)');
  await page.screenshot({ path: filePath('exam-preparation-primary.png'), animations: 'disabled', fullPage: true });
  checks.push('Preview and final-confirmation actions remain readable; preparation spinners are green');

  await page.goto(base + '/settings');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal((await style(page.getByRole('radio', { name: 'Dark', exact: true }))).accent, 'rgb(52, 211, 153)');
  await solidPrimary(page.locator('button[type="submit"]'));
  await page.screenshot({ path: filePath('settings-primary-dark.png'), animations: 'disabled', fullPage: true });
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  assert.equal((await style(page.getByRole('radio', { name: 'Light', exact: true }))).accent, 'rgb(4, 120, 87)');
  checks.push('Settings radios follow the primary accent in light and dark themes');
  assert.deepEqual(errors, []); assert.deepEqual(unknown, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ status: 'passed', checks }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  await page.screenshot({ path: filePath('failure.png'), animations: 'disabled', fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
