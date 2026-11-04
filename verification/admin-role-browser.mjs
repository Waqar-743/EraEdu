// Exercise real built routes with isolated accounts/data. No production writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4183';
const output = new URL('../backend/coverage/admin-role-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const checks = [], errors = [], unknown = [], writes = [];
const teacher = { id: 'teacher', name: 'Fixture Teacher', email: 'teacher@example.invalid', role: 'teacher' };
const student = { id: 'student', name: 'Fixture Student', email: 'student@example.invalid', role: 'student' };
const course = { _id: 'course', title: 'Fixture course', description: 'Course review', category: 'Other', difficulty: 'Beginner', createdBy: 'teacher', isEnrolled: true, canViewTopics: true };
const topic = { _id: 'topic', title: 'Fixture topic', courseId: 'course', content: 'Shared topic material', difficulty: 'Easy' };
const learning = { summary: { totalTeachers: 1, totalStudents: 1, totalCourses: 1, totalTests: 1, completedAttempts: 0, averageScore: null, passRate: null, pendingReviews: 0 }, teachers: [teacher], students: [student], courses: [{ id: 'course', title: course.title, teacherId: 'teacher', studentCount: 1, testCount: 1 }], enrollments: [{ id: 'enrollment', courseId: 'course', studentId: 'student', joinedAt: '2026-01-01' }], attempts: [] };
const routes = ['/quiz/start/topic', '/quiz/exam/attempt/result', '/quiz/access-by-code', '/quiz/take/result', '/dashboard/student/join-quiz'];

async function account(role) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const requested = [];
  page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
  await context.route('**/api/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    requested.push(endpoint);
    if (request.method() !== 'GET') writes.push(`${role}: ${request.method()} ${endpoint}`);
    if (endpoint === '/auth/me') return role === 'guest' ? reply({ success: false, error: { code: 'AUTH_REQUIRED' } }, 401)
      : reply({ success: true, data: { _id: role, name: `Fixture ${role}`, email: `${role}@example.invalid`, role } });
    if (endpoint === '/notifications') return reply({ success: true, data: [] });
    if (endpoint === '/admin/overview') return reply({ success: true, data: { users: 3, courses: 1, quizzes: 1, attempts: 1, violations: 0, suspendedUsers: 0, roles: { student: 1, teacher: 1, admin: 1 }, roleTotal: 3 } });
    if (endpoint === '/admin/feedback' || endpoint === '/admin/integrity-events') return reply({ success: true, data: [] });
    if (endpoint === '/admin/learning-activity') return reply({ success: true, data: learning });
    if (endpoint === '/admin/attempts') return reply({ success: true, data: [{ id: 'result', student: student.name, studentEmail: student.email, assessment: 'Fixture test', assessmentType: 'Teacher test', course: course.title, status: 'completed', referenceIssues: [], startedAt: '2026-01-01' }], pagination: { total: 1 } });
    if (endpoint === '/courses/course') return reply({ success: true, data: course });
    if (endpoint === '/courses/course/topics') return reply({ success: true, data: [topic] });
    if (endpoint === '/courses/course/topics/topic') return reply({ success: true, data: topic });
    if (endpoint.startsWith('/quizzes/attempt/') && endpoint.endsWith('/results')) {
      const pending = endpoint.includes('/pending/');
      return reply({ success: true, data: { id: pending ? 'pending' : 'result', studentName: student.name, studentEmail: student.email, status: 'completed', startedAt: '2026-01-01', completedAt: '2026-01-01', score: pending ? undefined : 1, maxScore: pending ? undefined : 1, percentage: pending ? undefined : 100, reviewPending: pending, reviewStatus: pending ? 'pending' : 'reviewed', answers: pending ? [] : [{ questionId: 'exam-q0', selectedAnswer: 1, isCorrect: false }], violations: [], quiz: { title: 'Fixture test', questions: [{ text: 'Fixture question', options: ['A', 'B'], correctAnswer: 0 }] } } });
    }
    if (endpoint === '/analytics/teacher/stats') return reply({ success: true, data: { totalStudents: 1, totalCourses: 1, totalTopics: 1, totalQuestions: 1, activeEnrollments: 1, totalQuizzes: 1, totalAttempts: 0, avgStudentScore: null, passRate: null, pendingReviews: 0 } });
    if (endpoint === '/analytics/teacher/course-performance' || endpoint === '/analytics/teacher/recent-activity') return reply({ success: true, data: [] });
    if (endpoint === '/quizzes/teacher/analytics') return reply({ success: true, data: { totalStudents: 1, totalQuizzes: 0, totalAttempts: 0, avgScore: null, passRate: null, pendingReviews: 0, weeklyData: [], scoreDistribution: [], courseParticipation: [] } });
    if (endpoint === '/quizzes/teacher/my-quizzes' || endpoint === '/courses/teacher/my-courses' || endpoint === '/courses/teacher/questions') return reply({ success: true, data: [] });
    unknown.push(`${role}: ${request.method()} ${endpoint}`);
    return reply({ success: false, error: { message: 'Unexpected fixture request' } }, 500);
  });
  return { context, page, requested };
}

async function noLearnerActions(page) {
  assert.equal(await page.locator('a[href*="/dashboard/student"], a[href^="/quiz/start/"], a[href="/quiz/access-by-code"], a[href^="/quiz/take/"]').count(), 0);
  assert.equal(await page.getByRole('link', { name: /Take.*Exam|Join.*Exam/i }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Start Exam|Take.*Exam|Join.*Exam/i }).count(), 0);
}

try {
  const { context, page, requested } = await account('admin');
  await page.goto(base + '/dashboard/admin/analytics');
  await page.getByRole('heading', { name: 'Teachers & courses' }).waitFor();
  await noLearnerActions(page);
  const assessments = page.getByRole('link', { name: 'Assessments', exact: true });
  assert.equal(await assessments.getAttribute('href'), '/dashboard/admin/attempts');
  await assessments.click();
  await page.getByRole('heading', { name: 'Assessment activity', exact: true }).waitFor();
  assert.match(await page.locator('main').innerText(), /Fixture Student/);
  await noLearnerActions(page);
  assert.equal(requested.includes('/quizzes/teacher/my-quizzes'), false);
  checks.push('Admin Assessments opens platform activity, with no My Exams or exam authoring requests');

  await page.goto(base + '/dashboard/admin/quizzes');
  await page.waitForURL('**/dashboard/admin/attempts');
  await page.getByRole('heading', { name: 'Assessment activity', exact: true }).waitFor();
  await page.goto(base + '/analytics');
  await page.waitForURL('**/dashboard/admin/analytics');
  await page.getByRole('heading', { name: 'Learning Analytics', exact: true }).waitFor();
  await page.goto(base + '/dashboard-old');
  await page.waitForURL('**/dashboard/admin');
  await page.getByRole('heading', { name: /Good morning/i }).waitFor();
  checks.push('Legacy assessment, analytics and dashboard bookmarks stay in administrator oversight');

  for (const path of routes) {
    await page.goto(base + path);
    await page.waitForURL('**/dashboard/admin');
    await page.getByRole('heading', { name: /Good morning/i }).waitFor();
    await noLearnerActions(page);
  }
  assert.equal(requested.some(path => /topic-attempt|\/active$|\/generate$|\/start-by-code|\/access-by-code/.test(path)), false);
  checks.push('All five exam-taking entry points redirect admins before learner API calls');

  await page.goto(base + '/courses/course');
  await page.getByRole('heading', { name: course.title, exact: true }).waitFor();
  await page.getByRole('link', { name: 'Study', exact: true }).waitFor();
  await noLearnerActions(page);
  await page.getByRole('link', { name: 'Study', exact: true }).click();
  await page.waitForURL('**/courses/course/topics/topic');
  await page.getByRole('heading', { name: topic.title, exact: true, level: 1 }).waitFor();
  assert.match(await page.locator('main').innerText(), /Shared topic material/);
  await noLearnerActions(page);
  checks.push('Admins can inspect course/topic material without enrollment or Take Exam actions');

  for (const path of ['/quiz/results/result', '/quiz/results/pending', '/quiz/teacher-results/result', '/quiz/teacher-results/pending']) {
    await page.goto(base + path);
    await page.getByRole('heading', { name: /Student exam result|Awaiting teacher review/ }).first().waitFor();
    await page.getByText('Fixture Student', { exact: false }).first().waitFor();
    await noLearnerActions(page);
    assert.doesNotMatch(await page.locator('body').innerText(), /Your exam|Your answers|Your submission|Congratulations|Take Another Exam|Your answer:/);
  }
  await page.getByRole('button', { name: 'Back to Dashboard', exact: true }).click();
  await page.waitForURL('**/dashboard/admin');
  checks.push('Both completed and pending result views identify the student, with admin-safe return actions');
  await context.close();

  const educator = await account('teacher');
  for (const path of routes.slice(0, 4)) {
    await educator.page.goto(base + path);
    await educator.page.waitForURL('**/dashboard/teacher');
    await educator.page.getByRole('heading', { name: /Welcome/i }).waitFor();
  }
  await educator.page.goto(base + '/dashboard/teacher/quizzes');
  await educator.page.getByRole('heading', { name: 'My Exams', exact: true }).waitFor();
  await educator.page.getByRole('button', { name: 'Create Exam', exact: true }).waitFor();
  await educator.page.goto(base + '/analytics');
  await educator.page.waitForURL('**/dashboard/teacher/analytics');
  await educator.page.getByRole('heading', { name: 'Analytics Dashboard', exact: true }).waitFor();
  await educator.page.goto(base + '/quiz/teacher-results/result');
  await educator.page.getByRole('heading', { name: 'Student exam result', exact: true }).waitFor();
  await noLearnerActions(educator.page);
  assert.equal(await educator.page.getByRole('link', { name: 'View Submissions', exact: true }).getAttribute('href'), '/dashboard/teacher/submissions');
  checks.push('Teachers retain exam authoring and analytics; result reviews do not ask them to take exams');
  await educator.context.close();

  const learner = await account('student');
  await learner.page.goto(base + '/courses/course');
  await learner.page.getByRole('link', { name: 'Take Exam', exact: true }).waitFor();
  await learner.page.goto(base + '/courses/course/topics/topic');
  await learner.page.getByRole('link', { name: 'Take Exam for this Topic', exact: true }).click();
  await learner.page.getByRole('heading', { name: 'Ready to Start?', exact: true }).waitFor();
  await learner.page.getByRole('button', { name: 'Start Exam', exact: true }).waitFor();
  await learner.page.goto(base + '/quiz/access-by-code');
  await learner.page.getByRole('heading', { name: 'Access Exam via Code', exact: true }).waitFor();
  await learner.page.goto(base + '/dashboard/student/join-quiz');
  await learner.page.getByRole('heading', { name: 'Join Exam', exact: true }).waitFor();
  await learner.page.goto(base + '/quiz/teacher-results/result');
  await learner.page.getByRole('heading', { name: 'Congratulations!', exact: true }).waitFor();
  assert.equal(await learner.page.getByRole('link', { name: 'Take Another Exam', exact: true }).getAttribute('href'), '/dashboard/student/join-quiz');
  checks.push('Students retain course/topic exam actions, code entry, start controls and retake navigation');
  await learner.context.close();

  const guest = await account('guest');
  await guest.page.goto(base + '/quiz/take/result');
  await guest.page.waitForURL('**/login');
  await guest.page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await guest.context.close();
  checks.push('Unauthenticated exam URLs still require sign-in');
  assert.deepEqual(unknown, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ status: 'passed', checks }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} finally { await browser.close(); }
