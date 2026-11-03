process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-ok';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-anon-key';
process.env.NODE_ENV = 'test';
const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
import { cheatingViolationService } from '../services/cheatingViolationService';
import { quizService } from '../services/quizService';

function setup() {
  const attempt = { id: 'attempt', user_id: 'student', quiz_id: 'topic-quiz', topic_id: 'topic',
    status: 'in-progress', score: 1, max_score: 5, answers: [{ questionId: 'question', selectedAnswer: 1, isCorrect: true }],
    topic_question_snapshot: Array.from({ length: 5 }, (_, index) => ({ id: `question-${index}`, text: 'Question', options: ['A','B'], correctAnswer: 1, timeLimit: 60 })) };
  const course = { id: 'course', created_by: 'current-teacher' };
  const events: any[] = [];
  const tables: Record<string, any[]> = { quiz_attempts: [attempt], topics: [{ id: 'topic', course_id: 'course' }],
    courses: [course], cheating_violations: events, teacher_quizzes: [], quizzes: [{ id: 'topic-quiz', topic_id: 'topic', title: 'Topic exam' }] };
  mockFrom.mockImplementation((table: string) => {
    if (!tables[table]) throw new Error(`Unexpected table ${table}`);
    const filters: Array<[string, unknown]> = [];
    let mode = 'read', changes: any, row: any, count = false;
    const matching = () => tables[table].filter(item => filters.every(([key, value]) =>
      value && typeof value === 'object' && 'values' in value ? (value.values as unknown[]).includes(item[key]) : item[key] === value));
    const result = () => {
      if (mode === 'insert') {
        const duplicate = events.some(item => item.event_id === row.event_id && item.quiz_attempt_id === row.quiz_attempt_id);
        if (duplicate) return { data: null, error: { code: '23505' } };
        events.push(row);
        return { data: row, error: null };
      }
      if (mode === 'update') matching().forEach(item => Object.assign(item, changes));
      return { data: matching(), count: count ? matching().length : null, error: null };
    };
    const query: any = {
      select: (fields: string, options: any) => {
        if (table === 'courses' && !['created_by', 'id'].includes(fields)) throw new Error(`Unknown course manager field ${fields}`);
        count = options?.count === 'exact'; return query;
      },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      in: (key: string, values: unknown[]) => { filters.push([key, { values }]); return query; },
      insert: (rows: any[]) => { mode = 'insert'; row = { id: `row-${events.length + 1}`, ...rows[0] }; return query; },
      update: (value: any) => { mode = 'update'; changes = value; return query; },
      order: () => query,
      single: async () => { const value = result(); return { ...value, data: Array.isArray(value.data) ? value.data[0] : value.data }; },
      maybeSingle: async () => { const value = result(); return { ...value, data: Array.isArray(value.data) ? value.data[0] : value.data }; },
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
  return { attempt, course, events };
}
const report = (eventId: string) => cheatingViolationService.reportViolation({ quizAttemptId: 'attempt', studentId: 'student',
  quizId: 'spoofed-quiz', teacherId: 'spoofed-teacher', violationType: 'NO_FACE', detectionMethod: 'camera_face_detection', eventId });
beforeEach(() => mockFrom.mockReset());

test('topic camera events use the authenticated attempt and current course teacher, with stable retries', async () => {
  const { events } = setup();
  const first = await report('camera-1');
  const retry = await report('camera-1');
  expect(first).toMatchObject({ violationId: 'row-1', violationCount: 1, violationLimit: 3, autoSubmitted: false });
  expect(retry).toEqual(first);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ quiz_id: 'topic-quiz', teacher_id: 'current-teacher', student_id: 'student',
    violation_type: 'no_face', detection_method: 'camera_face_detection' });
  expect(mockFrom).not.toHaveBeenCalledWith('teacher_quizzes');
});

test('three topic signals finish once while preserving already graded answers; late evidence remains reviewable', async () => {
  const { attempt, events } = setup();
  const answers = JSON.stringify(attempt.answers);
  await report('camera-1'); await report('camera-2');
  await expect(report('camera-3')).resolves.toMatchObject({ autoSubmitted: true, violationCount: 3 });
  expect(attempt).toMatchObject({ status: 'completed', score: 1, max_score: 5, auto_submitted: true });
  await expect(report('camera-delayed')).resolves.toMatchObject({ violationId: 'row-4', autoSubmitted: false,
    alreadySubmitted: true, violationCount: 4 });
  expect(JSON.stringify(attempt.answers)).toBe(answers);
  expect(attempt.score).toBe(1);
  expect(events).toHaveLength(4);
  await expect(quizService.getAttemptResults('attempt', 'student', 'student')).resolves.toMatchObject({
    score: 1, maxScore: 5, percentage: 20, autoSubmitted: true, submissionReason: 'excessive_violations',
  });
});

test('topic evidence access follows current course assignment, not historic event teacher_id', async () => {
  const { course } = setup();
  await report('camera-1');
  await expect(cheatingViolationService.getViolationsForAttempt('attempt', 'current-teacher', 'teacher'))
    .resolves.toEqual([expect.objectContaining({ type: 'no_face', detectionMethod: 'camera_face_detection' })]);
  course.created_by = 'new-teacher';
  await expect(cheatingViolationService.getViolationsForAttempt('attempt', 'current-teacher', 'teacher'))
    .rejects.toMatchObject({ statusCode: 403 });
  await expect(cheatingViolationService.getViolationsForAttempt('attempt', 'new-teacher', 'teacher')).resolves.toHaveLength(1);
  await expect(cheatingViolationService.getViolationsForAttempt('attempt', 'student', 'student')).rejects.toMatchObject({ statusCode: 403 });
  await expect(cheatingViolationService.assertAttemptManagementAccess('attempt', 'new-teacher', 'teacher')).resolves.toBeUndefined();
  await expect(cheatingViolationService.assertAttemptManagementAccess('attempt', 'current-teacher', 'teacher')).rejects.toMatchObject({ statusCode: 403 });
});

test('teacher monitoring summaries include topic camera events and follow reassignment', async () => {
  const { course } = setup();
  await report('camera-1');
  await expect(cheatingViolationService.getViolationSummary('current-teacher')).resolves.toMatchObject({
    totalViolations: 1, byType: { no_face: 1, face_away: 0 }, suspiciousAttempts: 1,
  });
  course.created_by = 'new-teacher';
  await expect(cheatingViolationService.getViolationSummary('current-teacher')).resolves.toMatchObject({ totalViolations: 0 });
  await expect(cheatingViolationService.getViolationSummary('new-teacher')).resolves.toMatchObject({ totalViolations: 1 });
});
