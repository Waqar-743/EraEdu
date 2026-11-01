process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-result-metrics-test-secret-long-enough';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-anon-key';

const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../services/authService', () => ({ assertStudentEmailPolicy: jest.fn() }));
import { analyticsService } from '../services/analyticsService';
import { quizService } from '../services/quizService';
import { finalResultPercentage, summarizeResults } from '../services/resultMetrics';

type Row = Record<string, any>;
function database(attempts: Row[], quizzes: Row[] = [{ id: 'exam', title: 'Exam', course_id: 'course', teacher_id: 'teacher' }]) {
  const rows: Record<string, Row[]> = {
    courses: [{ id: 'course', title: 'Course', created_by: 'teacher' }],
    enrollments: [{ id: 'enrollment', course_id: 'course', user_id: 'student' }],
    teacher_quizzes: quizzes, quiz_attempts: attempts, topics: [], questions: [], notifications: [],
  };
  const pages: Array<[string, number, number]> = [];
  mockFrom.mockImplementation((table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | undefined;
    const result = () => {
      const data = rows[table].filter(row => filters.every(filter => filter(row)));
      if (patch) data.forEach(row => Object.assign(row, patch));
      return { data, count: data.length, error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, ids: unknown[]) => { filters.push(row => ids.includes(row[key])); return query; },
      order: () => query,
      update: (value: Row) => { patch = value; return query; },
      insert: async (value: Row[]) => { rows[table].push(...value); return { error: null }; },
      single: async () => ({ ...result(), data: result().data[0] }),
      range: async (start: number, end: number) => {
        pages.push([table, start, end]);
        return { ...result(), data: result().data.slice(start, end + 1) };
      },
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
  return { rows, pages };
}

const attempt = (id: string, grade: number | null, extra: Row = {}) => ({
  id, quiz_id: 'exam', user_id: 'student', status: 'completed', teacher_grade: grade,
  score: 0, max_score: 10, completed_at: new Date().toISOString(), ...extra,
});

beforeEach(() => mockFrom.mockReset());

test('final grades replace automatic marks, retain zero and exclude pending, active or invalid results', () => {
  expect(finalResultPercentage(attempt('a', 80))).toBe(80);
  expect(finalResultPercentage(attempt('zero', 0, { score: 10 }))).toBe(0);
  for (const row of [attempt('pending', null), attempt('active', 100, { status: 'in-progress' }),
    attempt('invalid', NaN), attempt('invalid', 101), attempt('invalid', Infinity)]) {
    expect(finalResultPercentage(row)).toBeNull();
  }
  expect(finalResultPercentage(attempt('topic', null, { topic_id: 'topic', score: 2, max_score: 3 }))).toBeCloseTo(66.6667);
  expect(summarizeResults([attempt('pending', null)])).toMatchObject({ avgScore: null, passRate: null, pendingReviews: 1 });
  expect(summarizeResults([attempt('boundary', 60), attempt('below', 59.9)])).toMatchObject({ avgScore: 60, passRate: 50 });
});

test('overview, analytics, course performance and learner metrics agree and reflect subsequent grade edits', async () => {
  const { rows } = database([
    attempt('graded', 80), attempt('zero', 0, { score: 10 }), attempt('pending', null),
    attempt('active', 100, { status: 'in-progress' }),
    attempt('other', 100, { quiz_id: 'other-exam', user_id: 'other-student' }),
  ], [
    { id: 'exam', title: 'Exam', course_id: 'course', teacher_id: 'teacher' },
    { id: 'other-exam', title: 'Other', course_id: 'other-course', teacher_id: 'other-teacher' },
  ]);
  const overview = await analyticsService.getTeacherStats('teacher');
  const analytics = await quizService.getTeacherAnalytics('teacher');
  expect(overview).toMatchObject({ avgStudentScore: 40, passRate: 50, reviewedAttempts: 2, pendingReviews: 1 });
  expect(analytics).toMatchObject({ avgScore: 40, passRate: 50, totalAttempts: 3, reviewedAttempts: 2, pendingReviews: 1 });
  expect(analytics.weeklyData[3]).toMatchObject({ attempts: 3, avgScore: 40 });
  expect(analytics.scoreDistribution.map(bucket => bucket.count)).toEqual([1, 0, 1, 0]);
  await expect(analyticsService.getTeacherCoursePerformance('teacher')).resolves.toMatchObject([{ avgScore: 40, passRate: 50, completionRate: 75 }]);
  await expect(quizService.getStudentAnalytics('student')).resolves.toMatchObject({ avgScore: 40, passRate: 50, pendingReviews: 1 });
  await expect(analyticsService.getDashboardStats('student')).resolves.toMatchObject({ averageScore: 40, passRate: 50, pendingReviews: 1 });

  await quizService.gradeSubmission('graded', 'teacher', 50, 'Adjusted after review');
  await expect(analyticsService.getTeacherStats('teacher')).resolves.toMatchObject({ avgStudentScore: 25, passRate: 0 });
  await expect(quizService.getTeacherAnalytics('teacher')).resolves.toMatchObject({ avgScore: 25, passRate: 0 });
  await expect(analyticsService.getTeacherCoursePerformance('teacher')).resolves.toMatchObject([{ avgScore: 25, passRate: 0 }]);
  await expect(quizService.getStudentAnalytics('student')).resolves.toMatchObject({ avgScore: 25, passRate: 0 });
  expect(rows.quiz_attempts.find(row => row.id === 'graded')).toMatchObject({ teacher_grade: 50, score: 0, max_score: 10 });
});

test('metrics read every page and batch quiz IDs instead of silently truncating large classes', async () => {
  const quizzes = Array.from({ length: 101 }, (_, index) => ({ id: `exam-${index}`, course_id: 'course', teacher_id: 'teacher' }));
  const { pages } = database(Array.from({ length: 501 }, (_, index) =>
    attempt(`attempt-${index}`, index === 500 ? 100 : 0, { quiz_id: 'exam-100' })), quizzes);
  await expect(analyticsService.getTeacherStats('teacher')).resolves.toMatchObject({ avgStudentScore: 0.2, passRate: 0.2, reviewedAttempts: 501 });
  await expect(quizService.getTeacherAnalytics('teacher')).resolves.toMatchObject({ avgScore: 0.2, passRate: 0.2, totalAttempts: 501 });
  expect(pages).toContainEqual(['quiz_attempts', 500, 999]);
});

test('failed metric reads propagate errors instead of presenting a zero pass rate', async () => {
  database([]);
  const normalFrom = mockFrom.getMockImplementation()!;
  mockFrom.mockImplementation(table => table === 'quiz_attempts'
    ? { select: () => ({ in: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: 'database unavailable' } }) }) }) }) }) }
    : normalFrom(table));
  await expect(quizService.getTeacherAnalytics('teacher')).rejects.toThrow('Failed to load quiz_attempts: database unavailable');
});
