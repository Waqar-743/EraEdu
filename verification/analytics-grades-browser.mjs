// Intercepted fixtures only: these checks never update a real account or grade.
// Run after building the frontend and serving its preview on 127.0.0.1:4173.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve('backend/coverage/analytics-grades-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const teacher = { _id: 'fixture-teacher', role: 'teacher', name: 'Fixture Teacher', email: 'teacher@example.invalid' };
const student = { _id: 'fixture-student', role: 'student', name: 'Fixture Student', email: 'student@example.invalid' };
const success = data => ({ success: true, data });
const now = new Date().toISOString();

function fixtures(grades) {
  const state = { grades, writes: [], reads: [] };
  const metrics = () => {
    const published = state.grades.filter(grade => grade !== null);
    const round = value => Math.round(value * 10) / 10;
    return { avgScore: published.length ? round(published.reduce((sum, grade) => sum + grade, 0) / published.length) : null,
      passRate: published.length ? round(published.filter(grade => grade >= 60).length / published.length * 100) : null,
      reviewedAttempts: published.length, pendingReviews: state.grades.length - published.length };
  };
  const handler = async ({ endpoint, request, reply }) => {
    if (request.method() === 'GET') state.reads.push(endpoint);
    const summary = metrics();
    const reads = {
      '/analytics/teacher/stats': { totalCourses: 1, totalStudents: 1, totalQuestions: 1, totalTopics: 1,
        activeEnrollments: 1, avgStudentScore: summary.avgScore, ...summary },
      '/analytics/teacher/course-performance': [{ courseName: 'Fixture Course', avgScore: summary.avgScore, completionRate: 100, enrollments: 1 }],
      '/analytics/teacher/recent-activity': [],
      '/quizzes/teacher/analytics': { ...summary, totalStudents: 1, totalQuizzes: 1, totalAttempts: state.grades.length,
        scoreDistribution: [{ range: '0-50', count: state.grades.filter(grade => grade !== null && grade < 50).length, color: '#EF4444' },
          { range: '50-100', count: state.grades.filter(grade => grade !== null && grade >= 50).length, color: '#10B981' }],
        weeklyData: [{ date: 'Week 1', attempts: state.grades.length, avgScore: summary.avgScore }],
        courseParticipation: [{ courseId: 'fixture-course', courseName: 'Fixture Course', enrolledStudents: 1, attemptedStudents: 1, participationPercentage: 100 }] },
      '/quizzes/teacher/submissions': state.grades.map((grade, index) => ({
        id: `fixture-attempt-${index}`, quizId: 'fixture-exam', quizTitle: 'Fixture Exam',
        studentId: student._id, studentName: student.name, studentEmail: student.email,
        score: 0, maxScore: 10, percentage: 0, teacherGrade: grade, teacherFeedback: '', status: 'completed',
        startedAt: now, completedAt: now, answers: [], violations: [],
      })),
      '/quizzes/teacher/quiz/fixture-exam': { id: 'fixture-exam', title: 'Fixture Exam', questions: [
        { text: 'Explain this concept', questionType: 'shortAnswer', options: [], correctAnswer: -1 },
      ] },
      '/quizzes/attempts/fixture-attempt-0/violations': [],
      '/analytics/dashboard': { ...summary, averageScore: summary.avgScore, coursesEnrolled: 1,
        quizzesCompleted: state.grades.length, streakDays: 1 },
      '/quizzes/student/analytics': { ...summary, totalQuizzes: state.grades.length, streakDays: 1,
        performanceData: state.grades.filter(grade => grade !== null).map((score, index) => ({ week: `Exam ${index + 1}`, score })) },
    };
    if (request.method() === 'GET' && endpoint in reads) { await reply(success(reads[endpoint])); return true; }
    if (request.method() === 'PUT' && endpoint === '/quizzes/submissions/fixture-attempt-0/grade') {
      assert.equal(request.headers()['x-eraedu-account'], teacher._id);
      state.writes.push(request.postDataJSON());
      state.grades[0] = request.postDataJSON().grade;
      await reply(success({ success: true }));
      return true;
    }
    return false;
  };
  return { state, handler };
}

async function scenario(name, user, fixture, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const unknown = [], errors = [];
  await context.route('**/api/**', async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint === '/auth/me') return reply(success(user));
    if (endpoint === '/notifications') return reply(success([]));
    if (await fixture.handler({ endpoint, request, reply })) return;
    unknown.push(`${request.method()} ${endpoint}`);
    return reply({ success: false, message: 'Unexpected fixture request' }, 500);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await run(page, fixture.state);
    assert.deepEqual(unknown, []);
    assert.deepEqual(errors, []);
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.stack?.slice(0, 1800) || String(error) });
    await page.screenshot({ path: path.join(output, `${name}-failure.png`), fullPage: true }).catch(() => {});
  } finally { await context.close(); }
  console.log(JSON.stringify(results.at(-1)));
}

async function expectStat(page, label, value) {
  const valueNode = page.getByText(label, { exact: true }).locator('..').locator('p').nth(1);
  await valueNode.getByText(value, { exact: true }).waitFor();
  assert.equal(await valueNode.textContent(), value);
}
async function focusRefresh(page) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }

try {
  await scenario('teacher-overview-and-analytics-refresh', teacher, fixtures([80, 0, null]), async (page, state) => {
    await page.goto(`${base}/dashboard/teacher`);
    await expectStat(page, 'Avg. Student Score', '40%');
    await expectStat(page, 'Pass Rate', '50%');
    await page.getByText('1 submission(s) await review.', { exact: false }).waitFor();
    state.grades = [100, 80, null];
    await focusRefresh(page);
    await expectStat(page, 'Avg. Student Score', '90%');
    await expectStat(page, 'Pass Rate', '100%');
    assert.ok(state.reads.filter(endpoint => endpoint === '/analytics/teacher/stats').length >= 2);
    await page.screenshot({ path: path.join(output, 'teacher-overview.png'), fullPage: true });
    await page.goto(`${base}/dashboard/teacher/analytics`);
    await expectStat(page, 'Average Score', '90%');
    await expectStat(page, 'Pass Rate', '100%');
    state.grades = [0, 80, null];
    await focusRefresh(page);
    await expectStat(page, 'Average Score', '40%');
    await expectStat(page, 'Pass Rate', '50%');
    assert.ok(state.reads.filter(endpoint => endpoint === '/quizzes/teacher/analytics').length >= 2);
    assert.deepEqual(state.writes, []);
  });

  await scenario('teacher-grade-zero-updates-both-summaries', teacher, fixtures([80]), async (page, state) => {
    await page.goto(`${base}/dashboard/teacher/submissions`);
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('heading', { name: 'Review Submission', exact: true }).waitFor();
    await page.getByPlaceholder('Enter grade').fill('0');
    await page.getByPlaceholder('Write feedback for the student...').fill('Reviewed final grade');
    await page.getByRole('button', { name: 'Save Grade', exact: true }).click();
    await page.getByText('Grade saved and student notified!', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Review Submission', exact: true }).waitFor({ state: 'hidden' });
    await page.getByText('0%', { exact: true }).waitFor();
    assert.deepEqual(state.writes, [{ grade: 0, feedback: 'Reviewed final grade' }]);
    await page.goto(`${base}/dashboard/teacher`);
    await expectStat(page, 'Avg. Student Score', '0%');
    await expectStat(page, 'Pass Rate', '0%');
    await page.goto(`${base}/dashboard/teacher/analytics`);
    await expectStat(page, 'Average Score', '0%');
    await expectStat(page, 'Pass Rate', '0%');
  });

  await scenario('learner-released-grades-and-pending-refresh', student, fixtures([20]), async (page, state) => {
    await page.goto(`${base}/dashboard/student`);
    await expectStat(page, 'Average Score', '20%');
    await expectStat(page, 'Pass Rate', '0%');
    state.grades = [80];
    await focusRefresh(page);
    await expectStat(page, 'Average Score', '80%');
    await expectStat(page, 'Pass Rate', '100%');
    await page.goto(`${base}/analytics`);
    const metric = label => page.getByText(label, { exact: true }).locator('..').locator('dd');
    await metric('Released average score').getByText('80%', { exact: true }).waitFor();
    await metric('Pass rate').getByText('100%', { exact: true }).waitFor();
    state.grades = [null];
    await focusRefresh(page);
    await metric('Released average score').getByText('No released results', { exact: true }).waitFor();
    await metric('Pass rate').getByText('No released results', { exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: '1 result(s) pending teacher review.' }).waitFor();
    assert.deepEqual(state.writes, []);
  });
} finally { await browser.close(); }

const summary = { testedAt: new Date().toISOString(), scope: 'Intercepted browser fixtures only; no real accounts, grades or database writes',
  passed: results.filter(result => result.status === 'PASS').length, failed: results.filter(result => result.status === 'FAIL').length, results };
await writeFile(path.join(output, 'local.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }));
if (summary.failed) process.exitCode = 1;
