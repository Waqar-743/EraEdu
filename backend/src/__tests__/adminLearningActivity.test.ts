process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-ok';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-anon-key';
process.env.NODE_ENV = 'test';

const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../middleware/auth', () => ({
  authorize: jest.requireActual('../middleware/auth').authorize,
  protect: (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ success: false });
    req.user = { _id: 'admin-1', role }; next();
  },
}));

import express from 'express';
import request from 'supertest';
import adminRoutes from '../routes/admin';
import { adminLearningService } from '../services/adminLearningService';
import { errorHandler } from '../middleware/errorHandler';

const mcq = { questions: [{ text: 'Question', options: ['SECRET_ANSWER', 'Other'], correctAnswer: 0, questionType: 'multipleChoice' }] };
const written = { questions: [{ text: 'Explain', options: [], correctAnswer: -1, questionType: 'shortAnswer' }] };
const fixture = (): Record<string, any[]> => ({
  users: [
    { id: 'admin-1', name: 'Administrator', email: 'admin@example.invalid', role: 'admin', password: 'PRIVATE_PASSWORD', face_encoding: 'PRIVATE_FACE' },
    { id: 'teacher-1', name: 'Amina', email: 'amina@example.invalid', role: 'teacher' },
    { id: 'teacher-2', name: 'Bilal', email: 'bilal@example.invalid', role: 'teacher' },
    { id: 'teacher-3', name: 'No courses', email: 'empty@example.invalid', role: 'teacher' },
    { id: 'student-1', name: 'Sara', email: 'sara@example.invalid', role: 'student' },
    { id: 'student-2', name: 'Ali', email: 'ali@example.invalid', role: 'student' },
  ],
  courses: [
    { id: 'course-1', title: 'Algebra', created_by: 'teacher-1', is_published: false },
    { id: 'course-2', title: 'Biology', created_by: 'teacher-2', is_published: true },
    { id: 'course-3', title: 'Unassigned', created_by: null, is_published: false },
  ],
  enrollments: [
    { id: 'enrollment-1', user_id: 'student-1', course_id: 'course-1', enrolled_at: '2026-01-02T00:00:00Z' },
    { id: 'enrollment-2', user_id: 'student-1', course_id: 'course-2', enrolled_at: '2026-02-01T00:00:00Z' },
    { id: 'enrollment-3', user_id: 'student-2', course_id: 'course-1', enrolled_at: '2026-01-03T00:00:00Z' },
  ],
  teacher_quizzes: [
    { id: 'shared', title: 'Algebra MCQ', teacher_id: 'teacher-1', course_id: 'course-1' },
    { id: 'written', title: 'Written test', teacher_id: 'teacher-1', course_id: 'course-1' },
    { id: 'reassigned', title: 'Biology MCQ', teacher_id: 'teacher-1', course_id: 'course-2' },
  ],
  topics: [{ id: 'topic-2', title: 'Cells', course_id: 'course-2' }],
  quizzes: [{ id: 'shared', title: 'Cells topic test', topic_id: 'topic-2' }],
  quiz_attempts: [
    { id: 'attempt-1', user_id: 'student-1', quiz_id: 'shared', topic_id: null, status: 'completed', score: 1, max_score: 1, teacher_grade: 0, teacher_quiz_snapshot: mcq, started_at: '2026-04-01', completed_at: '2026-04-01' },
    { id: 'attempt-2', user_id: 'student-1', quiz_id: 'shared', topic_id: 'topic-2', status: 'completed', score: 1, max_score: 1, teacher_grade: null, started_at: '2026-04-02', completed_at: '2026-04-02' },
    { id: 'attempt-3', user_id: 'student-1', quiz_id: 'written', topic_id: null, status: 'completed', score: 0, max_score: 1, teacher_grade: null, teacher_quiz_snapshot: written, started_at: '2026-04-03', completed_at: '2026-04-03' },
    { id: 'attempt-4', user_id: 'student-1', quiz_id: 'reassigned', topic_id: null, status: 'in_progress', score: 0, max_score: 1, started_at: '2026-04-04' },
  ],
});

let tables: Record<string, any[]>;
let failedTable: string | undefined;
beforeEach(() => {
  tables = fixture(); failedTable = undefined; mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => ({ select: () => ({ order: () => ({
    range: async (start: number, end: number) => ({
      data: table === failedTable ? null : [...(tables[table] || [])].sort((a, b) => a.id.localeCompare(b.id)).slice(start, end + 1),
      error: table === failedTable ? { message: 'Database unavailable' } : null,
    }),
  }) }) }));
});

describe('administrator learning activity', () => {
  it('shows every teacher and course regardless of the administrator having no exams', async () => {
    const result = await adminLearningService.getActivity();
    expect(result.summary).toMatchObject({ totalTeachers: 3, totalStudents: 2, totalCourses: 3, totalTests: 4 });
    expect(result.teachers.map(person => person.name)).toEqual(['Amina', 'Bilal', 'No courses']);
    expect(result.courses).toContainEqual(expect.objectContaining({ title: 'Algebra', teacherId: 'teacher-1', studentCount: 2, testCount: 2, published: false }));
    expect(result.enrollments).toContainEqual(expect.objectContaining({ studentId: 'student-2', courseId: 'course-1', joinedAt: '2026-01-03T00:00:00Z' }));
    expect(result.students).toContainEqual(expect.objectContaining({ id: 'student-2', name: 'Ali' }));
  });

  it('distinguishes the two exam models even when their IDs collide', async () => {
    const result = await adminLearningService.getActivity();
    expect(result.attempts.find(row => row.id === 'attempt-1')).toMatchObject({ testTitle: 'Algebra MCQ', courseTitle: 'Algebra', teacherName: 'Amina', testType: 'Teacher test' });
    expect(result.attempts.find(row => row.id === 'attempt-2')).toMatchObject({ testTitle: 'Cells topic test', courseTitle: 'Biology', teacherName: 'Bilal', testType: 'Topic test' });
  });

  it('honors a grade of zero and excludes pending written work from final averages', async () => {
    const result = await adminLearningService.getActivity();
    expect(result.summary).toMatchObject({ completedAttempts: 3, averageScore: 50, passRate: 50, pendingReviews: 1 });
    expect(result.attempts.find(row => row.id === 'attempt-1')).toMatchObject({ percentage: 0, gradeSource: 'teacher' });
    expect(result.attempts.find(row => row.id === 'attempt-2')).toMatchObject({ percentage: 100, gradeSource: 'automatic' });
    expect(result.attempts.find(row => row.id === 'attempt-3')).toMatchObject({ percentage: null, gradeSource: 'pending' });
    expect(result.attempts.find(row => row.id === 'attempt-4')).toMatchObject({ percentage: null, gradeSource: 'in_progress', teacherName: 'Bilal' });
  });

  it('refreshes changed grades and current course assignments', async () => {
    tables.quiz_attempts[0].teacher_grade = 80;
    tables.courses[0].created_by = 'teacher-2';
    const result = await adminLearningService.getActivity();
    expect(result.summary).toMatchObject({ averageScore: 90, passRate: 100 });
    expect(result.attempts.find(row => row.id === 'attempt-1')).toMatchObject({ teacherName: 'Bilal', percentage: 80 });
  });

  it('deduplicates joined courses while retaining the earliest join date', async () => {
    tables.enrollments.push({ ...tables.enrollments[0], id: 'duplicate', enrolled_at: '2025-12-01T00:00:00Z' });
    const result = await adminLearningService.getActivity();
    expect(result.enrollments).toHaveLength(3);
    expect(result.enrollments.find(row => row.courseId === 'course-1' && row.studentId === 'student-1')?.joinedAt).toBe('2025-12-01T00:00:00Z');
  });

  it('retains attempts with missing references without pretending records still exist', async () => {
    tables.quiz_attempts.push({ id: 'historical', user_id: 'deleted-student', quiz_id: 'deleted-test', status: 'completed', teacher_grade: 60 });
    const result = await adminLearningService.getActivity();
    expect(result.attempts.find(row => row.id === 'historical')).toMatchObject({ studentName: 'Account unavailable', testTitle: 'Test unavailable', percentage: 60, referenceIssues: ['Student unavailable', 'Test unavailable', 'Course unavailable'] });
  });

  it('does not return password, face encodings, question snapshots or answer keys', async () => {
    const json = JSON.stringify(await adminLearningService.getActivity());
    for (const secret of ['PRIVATE_PASSWORD', 'PRIVATE_FACE', 'SECRET_ANSWER', 'teacher_quiz_snapshot', 'correctAnswer']) expect(json).not.toContain(secret);
  });

  it('reads beyond PostgREST page limits', async () => {
    tables.enrollments = Array.from({ length: 501 }, (_, index) => ({ id: `enrollment-${String(index).padStart(4, '0')}`, user_id: `learner-${index}`, course_id: 'course-1', enrolled_at: '2026-01-01' }));
    const result = await adminLearningService.getActivity();
    expect(result.summary.totalStudents).toBe(501);
    expect(result.enrollments).toHaveLength(501);
    expect(result.courses.find(course => course.id === 'course-1')?.studentCount).toBe(501);
  });

  it('returns genuine empty-state data', async () => {
    Object.keys(tables).forEach(key => { tables[key] = []; });
    await expect(adminLearningService.getActivity()).resolves.toMatchObject({ summary: { totalTeachers: 0, totalStudents: 0, totalCourses: 0, passRate: null, averageScore: null }, teachers: [], courses: [], enrollments: [], attempts: [] });
  });

  it.each(['users', 'courses', 'enrollments', 'teacher_quizzes', 'topics', 'quizzes', 'quiz_attempts'])('does not turn failed %s queries into empty reports', async table => {
    failedTable = table;
    await expect(adminLearningService.getActivity()).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('administrator activity route', () => {
  const app = express(); app.use('/api/admin', adminRoutes); app.use(errorHandler);
  it.each(['student', 'teacher'])('denies the %s role', async role => {
    expect((await request(app).get('/api/admin/learning-activity').set('x-test-role', role)).status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('requires authentication', async () => {
    expect((await request(app).get('/api/admin/learning-activity')).status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });
  it('returns teacher, student, course and test details to an administrator', async () => {
    const response = await request(app).get('/api/admin/learning-activity').set('x-test-role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body.data.attempts).toContainEqual(expect.objectContaining({ studentName: 'Sara', teacherName: 'Amina', courseTitle: 'Algebra', testTitle: 'Algebra MCQ' }));
  });
  it('returns a retryable failure when the report cannot load', async () => {
    failedTable = 'enrollments';
    expect((await request(app).get('/api/admin/learning-activity').set('x-test-role', 'admin')).status).toBe(503);
  });
});
