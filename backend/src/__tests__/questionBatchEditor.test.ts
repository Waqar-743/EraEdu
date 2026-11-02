process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-question-editor-secret-at-least-32-characters';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-key';
const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../services/emailService', () => ({ emailService: {} }));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import courses from '../routes/courses';
import { errorHandler } from '../middleware/errorHandler';

type Row = Record<string, any>;
let rows: Record<string, Row[]>;
const app = express();
app.use(express.json());
app.use('/api/courses', courses);
app.use(errorHandler);
const token = (id: string) => `Bearer ${jwt.sign({ id, role: 'teacher' }, process.env.JWT_SECRET!)}`;
const update = { text: 'Updated short answer', questionType: 'shortAnswer', options: [], correctAnswer: null,
  correctAnswers: ['Primary answer', 'Alternative answer'], difficulty: 'Hard', explanation: 'Updated explanation' };

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = {
    users: ['assigned-teacher', 'previous-teacher'].map(id => ({ id, role: 'teacher', is_suspended: false })),
    courses: [{ id: 'course', title: 'Assigned course', created_by: 'assigned-teacher' }],
    topics: [{ id: 'topic', course_id: 'course', title: 'Topic', order: 1 }],
    questions: [{ id: 'question', topic_id: 'topic', created_by: 'previous-teacher', content: 'Existing short answer',
      question_type: 'shortAnswer', options: [], correct_answer: null, correct_answers: ['First', 'Second'], difficulty: 'Hard' }],
  };
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | undefined;
    const result = () => {
      const data = rows[table].filter(row => filters.every(filter => filter(row)));
      if (patch) data.forEach(row => Object.assign(row, patch));
      return { data: structuredClone(data), count: data.length, error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query; },
      order: () => query,
      update: (value: Row) => { patch = value; return query; },
      single: async () => { const response = result(); return { ...response, data: response.data[0] || null }; },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data[0] || null }; },
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
});
afterEach(() => jest.restoreAllMocks());

it('returns every accepted short answer when opening the question bank', async () => {
  const response = await request(app).get('/api/courses/teacher/questions').set('Authorization', token('assigned-teacher')).expect(200);
  expect(response.body.data).toContainEqual(expect.objectContaining({
    _id: 'question', questionType: 'shortAnswer', correctAnswers: ['First', 'Second'], answerText: 'First',
  }));
});

it('lets the assigned course owner edit a previous author’s question and reload all alternatives', async () => {
  await request(app).put('/api/courses/questions/question').set('Authorization', token('assigned-teacher')).send(update).expect(200);
  expect(rows.questions[0]).toMatchObject({ created_by: 'previous-teacher', content: update.text,
    correct_answer: null, correct_answers: update.correctAnswers, question_type: 'shortAnswer' });
  const response = await request(app).get('/api/courses/teacher/questions').set('Authorization', token('assigned-teacher')).expect(200);
  expect(response.body.data).toContainEqual(expect.objectContaining({ text: update.text, correctAnswers: update.correctAnswers }));
});

it('denies the old author after course reassignment without updating the question', async () => {
  await request(app).put('/api/courses/questions/question').set('Authorization', token('previous-teacher')).send(update).expect(403);
  expect(rows.questions[0]).toMatchObject({ content: 'Existing short answer', correct_answers: ['First', 'Second'] });
});

it('preserves an owned standalone question and its accepted answers without requiring a topic', async () => {
  rows.courses = [];
  rows.topics = [];
  rows.questions[0].topic_id = null;
  rows.questions[0].created_by = 'assigned-teacher';
  await request(app).put('/api/courses/questions/question').set('Authorization', token('assigned-teacher'))
    .send({ ...update, topicId: '' }).expect(200);
  expect(rows.questions[0]).toMatchObject({ topic_id: null, content: update.text, correct_answers: update.correctAnswers });
  const response = await request(app).get('/api/courses/teacher/questions').set('Authorization', token('assigned-teacher')).expect(200);
  expect(response.body.data).toContainEqual(expect.objectContaining({ _id: 'question', topicId: null, correctAnswers: update.correctAnswers }));
});
