import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminRoster, matchesReportSearch, reportPage } from '../src/services/adminLearningView.ts';

const data = () => ({
  teachers: [{ id: 'teacher-a', name: 'Amina' }, { id: 'teacher-b', name: 'Bilal' }],
  students: [{ id: 'learner', name: 'Sara', email: 'sara@example.invalid' }, { id: 'new', name: 'Ali' }],
  courses: [{ id: 'math', title: 'Algebra', teacherId: 'teacher-a' }, { id: 'science', title: 'Biology', teacherId: 'teacher-b' }],
  enrollments: [{ id: 'one', studentId: 'learner', courseId: 'math' }, { id: 'two', studentId: 'learner', courseId: 'science' }, { id: 'three', studentId: 'new', courseId: 'math' }],
  attempts: [
    { id: 'a', studentId: 'learner', courseId: 'math', testId: 'same', testType: 'Teacher test', status: 'completed', percentage: 0 },
    { id: 'b', studentId: 'learner', courseId: 'math', testId: 'same', testType: 'Teacher test', status: 'completed', percentage: 100 },
    { id: 'c', studentId: 'learner', courseId: 'math', testId: 'same', testType: 'Topic test', status: 'completed', percentage: 100 },
    { id: 'd', studentId: 'learner', courseId: 'science', testId: 'other', testType: 'Teacher test', status: 'in_progress' },
  ],
});

test('a student joining multiple courses gets a separate, correctly attributed course row', () => {
  const rows = buildAdminRoster(data());
  const math = rows.find(row => row.studentId === 'learner' && row.courseId === 'math');
  const biology = rows.find(row => row.studentId === 'learner' && row.courseId === 'science');
  assert.equal(math.teacherName, 'Amina'); assert.equal(math.courseTitle, 'Algebra');
  assert.equal(biology.teacherName, 'Bilal'); assert.equal(biology.attempts.length, 1);
  assert.equal(math.attempts.length, 3); assert.equal(math.attempts[0].percentage, 0);
});
test('enrolled learners with no tests remain visible', () => {
  const row = buildAdminRoster(data()).find(row => row.studentId === 'new');
  assert.equal(row.studentName, 'Ali'); assert.equal(row.completedTests, 0); assert.deepEqual(row.attempts, []);
});
test('retakes count once as a completed test and exam models remain distinct', () => {
  const row = buildAdminRoster(data()).find(row => row.studentId === 'learner' && row.courseId === 'math');
  assert.equal(row.completedTests, 2); assert.equal(row.attempts.length, 3);
});
test('historical attempts do not fabricate current enrollments', () => {
  const value = data(); value.enrollments = [];
  assert.deepEqual(buildAdminRoster(value), []);
});
test('search matches student, teacher, course and test text without case sensitivity', () => {
  assert.equal(matchesReportSearch('  AMINA ', 'Sara', 'Amina', 'Algebra'), true);
  assert.equal(matchesReportSearch('cells', null, 'Cells test'), true);
  assert.equal(matchesReportSearch('missing', 'Algebra'), false);
  assert.equal(matchesReportSearch('', null), true);
});
test('pagination preserves all rows and clamps empty or shrinking data sets', () => {
  const rows = Array.from({ length: 51 }, (_, index) => index);
  assert.deepEqual([1, 2, 3].flatMap(page => reportPage(rows, page).rows), rows);
  assert.equal(reportPage(rows, 99).page, 3);
  assert.deepEqual(reportPage([], 2), { rows: [], page: 1, pages: 1, total: 0 });
});
