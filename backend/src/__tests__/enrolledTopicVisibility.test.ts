process.env.JWT_SECRET = 'isolated-enrolled-topic-test-secret-long-enough';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-key';
process.env.NODE_ENV = 'test';

const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../services/emailService', () => ({ emailService: {} }));
jest.mock('../services/aiService', () => ({ aiService: { generateQuestions: jest.fn() } }));

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import courseRoutes from '../routes/courses';
import { getQuizForTopic } from '../controllers/quizController';
import { protect, authorize } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

type Row = Record<string, any>;
const app = express();
app.use(express.json());
app.use('/api/courses', courseRoutes);
app.post('/api/quizzes/generate', protect, authorize('student'), getQuizForTopic);
app.use(errorHandler);
const authorization = (id: string, role: string) => `Bearer ${jwt.sign({ id, role }, process.env.JWT_SECRET!)}`;
const asTeacher = authorization('teacher-1', 'teacher');
const asStudent = authorization('student-1', 'student');
const asOutsider = authorization('student-2', 'student');
const asOtherTeacher = authorization('teacher-2', 'teacher');

function database(published = false) {
  const rows: Record<string, Row[]> = {
    users: ['teacher-1', 'teacher-2', 'student-1', 'student-2'].map(id => ({
      id, role: id.startsWith('teacher') ? 'teacher' : 'student', is_suspended: false, email: `${id}@nutech.edu.pk`,
    })),
    courses: [{ id: 'course-1', title: 'Private course', created_by: 'teacher-1', is_published: published, max_students: 10 }],
    enrollments: [{ id: 'enrollment-1', course_id: 'course-1', user_id: 'student-1' }],
    topics: [], questions: [], quizzes: [], quiz_attempts: [],
  };
  const state = { enrollmentError: false };
  mockFrom.mockImplementation((table: string) => {
    if (!rows[table]) throw new Error(`Unexpected table ${table}`);
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<[string, boolean]> = [];
    let columns = '*';
    let limit: number | undefined;
    let written: Row[] | undefined;
    const matching = () => rows[table].filter(row => filters.every(filter => filter(row))).sort((a, b) => {
      for (const [column, ascending] of orders) {
        if (a[column] === b[column]) continue;
        return (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
    const result = (start = 0, end = Infinity) => {
      const all = written || matching();
      let data = all.slice(start, Math.min(end + 1, limit ?? Infinity));
      if (table === 'enrollments' && columns.includes('courses(*)')) {
        data = data.map(row => ({ ...row, courses: rows.courses.find(course => course.id === row.course_id) }));
      }
      return { data: state.enrollmentError && table === 'enrollments' ? null : data, count: all.length,
        error: state.enrollmentError && table === 'enrollments' ? { message: 'Enrollment unavailable' } : null };
    };
    const query: any = {
      select: (value = '*') => { columns = value; return query; },
      eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return query; },
      in: (column: string, values: unknown[]) => { filters.push(row => values.includes(row[column])); return query; },
      order: (column: string, options: { ascending?: boolean } = {}) => { orders.push([column, options.ascending !== false]); return query; },
      limit: (value: number) => { limit = value; return query; },
      insert: (values: Row[]) => {
        written = values.map((row, index) => ({ ...row, id: `${table}-${rows[table].length + index + 1}` }));
        rows[table].push(...written);
        return query;
      },
      single: async () => { const response = result(); return { ...response, data: response.data?.[0] || null }; },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data?.[0] || null }; },
      range: async (start: number, end: number) => result(start, end),
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
  return { rows, state };
}

async function addTopic() {
  const response = await request(app).post('/api/courses/topics').set('Authorization', asTeacher)
    .send({ courseId: 'course-1', title: 'Teacher-added topic', description: 'Visible study material', order: 1 }).expect(201);
  return response.body.data._id as string;
}

beforeEach(() => { mockFrom.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it.each([false, true])('shows a teacher-created topic through enrolled count, course detail, list and study API (catalog published=%s)', async published => {
  database(published);
  const before = await request(app).get('/api/courses/my/enrolled').set('Authorization', asStudent).expect(200);
  expect(before.body.data[0].topicsCount).toBe(0);
  const topicId = await addTopic();
  const teacher = await request(app).get('/api/courses/teacher/topics').set('Authorization', asTeacher).expect(200);
  expect(teacher.body.data).toContainEqual(expect.objectContaining({ _id: topicId, title: 'Teacher-added topic' }));
  const enrolled = await request(app).get('/api/courses/my/enrolled').set('Authorization', asStudent).expect(200);
  expect(enrolled.body.data[0]).toMatchObject({ topicsCount: 1 });
  const course = await request(app).get('/api/courses/course-1').set('Authorization', asStudent).expect(200);
  expect(course.body.data).toMatchObject({ isEnrolled: true, canViewTopics: true });
  const list = await request(app).get('/api/courses/course-1/topics').set('Authorization', asStudent).expect(200);
  expect(list.body.data).toContainEqual(expect.objectContaining({ _id: topicId, title: 'Teacher-added topic' }));
  const study = await request(app).get(`/api/courses/course-1/topics/${topicId}`).set('Authorization', asStudent).expect(200);
  expect(study.body.data).toMatchObject({ _id: topicId, courseId: 'course-1', description: 'Visible study material' });
  expect(JSON.stringify([list.body, study.body])).not.toMatch(/correct_answer|correctAnswer|explanation/);
  if (!published) {
    const catalog = await request(app).get('/api/courses').expect(200);
    expect(catalog.body.data).toEqual([]);
  }
});

it('keeps private topic reads and writes restricted to enrolled students, owners and admins', async () => {
  const { rows } = database();
  const topicId = await addTopic();
  for (const token of [asOutsider, asOtherTeacher]) {
    await request(app).get('/api/courses/course-1/topics').set('Authorization', token).expect(403);
    await request(app).get(`/api/courses/course-1/topics/${topicId}`).set('Authorization', token).expect(403);
    await request(app).post('/api/courses/topics').set('Authorization', token)
      .send({ courseId: 'course-1', title: 'Forbidden topic' }).expect(403);
  }
  await request(app).get('/api/courses/course-1/topics').expect(401);
  await request(app).get(`/api/courses/course-1/topics/${topicId}`).expect(401);
  await request(app).get(`/api/courses/topics/${topicId}/questions`).set('Authorization', asStudent).expect(403);
  await request(app).get(`/api/courses/other-course/topics/${topicId}`).set('Authorization', asStudent).expect(404);
  rows.enrollments.length = 0;
  await request(app).get('/api/courses/course-1/topics').set('Authorization', asStudent).expect(403);
  await request(app).get(`/api/courses/course-1/topics/${topicId}`).set('Authorization', asStudent).expect(403);
  expect(rows.topics).toHaveLength(1);
});

it('keeps enrollment lookup errors visible instead of granting private topic access', async () => {
  const { state } = database();
  const topicId = await addTopic();
  state.enrollmentError = true;
  await request(app).get('/api/courses/course-1').set('Authorization', asStudent).expect(500);
  await request(app).get('/api/courses/course-1/topics').set('Authorization', asStudent).expect(500);
  await request(app).get(`/api/courses/course-1/topics/${topicId}`).set('Authorization', asStudent).expect(500);
});

it('allows private enrolled-topic practice only with a separately published exam and hides answer keys', async () => {
  const { rows } = database();
  const topicId = await addTopic();
  rows.quizzes.push({ id: 'quiz-1', topic_id: topicId, title: 'Topic practice', is_published: false, time_limit: 5 });
  rows.questions.push(...Array.from({ length: 5 }, (_, index) => ({ id: `question-${index}`, topic_id: topicId,
    content: `Question ${index}`, question_type: 'multipleChoice', options: ['A', 'B'], correct_answer: 0, difficulty: 'Medium' })));
  await request(app).post('/api/quizzes/generate').set('Authorization', asStudent).send({ topicId }).expect(403);
  rows.quizzes[0].is_published = true;
  await request(app).post('/api/quizzes/generate').set('Authorization', asOutsider).send({ topicId }).expect(403);
  const started = await request(app).post('/api/quizzes/generate').set('Authorization', asStudent).send({ topicId }).expect(200);
  expect(started.body.data).toMatchObject({ quizId: 'quiz-1', attemptId: 'quiz_attempts-1', question: { content: 'Question 0' } });
  expect(JSON.stringify(started.body)).not.toMatch(/correct_answer|correctAnswer/);
});
