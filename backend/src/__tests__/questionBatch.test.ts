process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-question-batch-secret-minimum-32-characters';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-key';
const mockFrom = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import questions from '../routes/questions';
import { errorHandler } from '../middleware/errorHandler';

const topicId = '10000000-0000-4000-8000-000000000001';
const otherTopic = '10000000-0000-4000-8000-000000000002';
const firstId = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';
const first = { id: firstId, topicId, questionText: ' Pick one ', questionType: 'multipleChoice',
  options: [' Alpha ', 'Beta'], correctAnswer: 0, difficulty: 'Easy', explanation: ' Why ' };
const second = { id: secondId, topicId, questionText: 'Name it', questionType: 'shortAnswer',
  correctAnswers: [' Answer ', 'Alternative'], difficulty: 'Hard' };
let stored: any[];
let writes: any[][];
let databaseFailure: boolean;
beforeEach(() => {
  stored = []; writes = []; databaseFailure = false;
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    const filters: Array<(row: any) => boolean> = [];
    let insertRows: any[] | undefined;
    const run = () => {
      if (insertRows) {
        writes.push(insertRows);
        if (databaseFailure) return { data: null, error: { code: 'XX000' } };
        if (insertRows.some(row => stored.some(saved => saved.id === row.id))) return { data: null, error: { code: '23505' } };
        stored.push(...structuredClone(insertRows));
        return { data: structuredClone(insertRows), error: null };
      }
      const rows = table === 'users' ? [
        { id: 'teacher', role: 'teacher', is_suspended: false },
        { id: 'student', role: 'student', is_suspended: false },
        { id: 'admin', role: 'admin', is_suspended: false },
      ] : table === 'topics' ? [{ id: topicId, course_id: 'course' }, { id: otherTopic, course_id: 'foreign-course' }]
        : table === 'courses' ? [{ id: 'course', created_by: 'teacher' }, { id: 'foreign-course', created_by: 'another-teacher' }]
          : stored;
      return { data: rows.filter(row => filters.every(filter => filter(row))), error: null };
    };
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      insert: (rows: any[]) => { insertRows = rows; return query; },
      single: async () => { const result = run(); return { ...result, data: result.data?.[0] || null }; },
      maybeSingle: async () => { const result = run(); return { ...result, data: result.data?.[0] || null }; },
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    };
    return query;
  });
});
const app = express();
app.use(express.json());
app.use('/api/questions', questions);
app.use(errorHandler);
const send = (body: object, role = 'teacher') => request(app).post('/api/questions/batch')
  .set('Authorization', `Bearer ${jwt.sign({ id: role, role }, process.env.JWT_SECRET!)}`)
  .set('X-EraEdu-Account', role).send(body);

it('creates an owned mixed question batch in one insert, preserving indexed and alternative answers', async () => {
  const response = await send({ questions: [{ ...first, createdBy: 'forged-owner' }, second] });
  expect(response.status).toBe(201);
  expect(writes).toHaveLength(1);
  expect(stored).toHaveLength(2);
  expect(stored[0]).toMatchObject({ id: firstId, content: 'Pick one', correct_answer: 0,
    options: ['Alpha', 'Beta'], explanation: 'Why', created_by: 'teacher' });
  expect(stored[1]).toMatchObject({ id: secondId, correct_answer: null, options: [], correct_answers: ['Answer', 'Alternative'] });
});

it.each([
  [undefined], [[]], [Array(101).fill(first)], [[first, { ...second, id: firstId }]],
  [[first, { ...second, questionText: ' ' }]], [[{ ...first, correctAnswer: 99 }]],
  [[{ ...second, correctAnswers: [] }]], [[{ ...first, topicId: 'not-a-uuid' }]],
])('rejects an invalid batch before any insert (%j)', async input => {
  expect((await send({ questions: input })).status).toBe(400);
  expect(writes).toHaveLength(0);
  expect(stored).toHaveLength(0);
});

it('authorizes every topic before inserting any question', async () => {
  expect((await send({ questions: [first, { ...second, topicId: otherTopic }] })).status).toBe(403);
  expect(writes).toHaveLength(0);
});

it('requires authentication and rejects student writers through the actual router', async () => {
  expect((await request(app).post('/api/questions/batch').send({ questions: [first] })).status).toBe(401);
  expect((await send({ questions: [first] }, 'student')).status).toBe(403);
  expect(writes).toHaveLength(0);
});

it('a lost-response retry returns the same stored questions without duplicates', async () => {
  expect((await send({ questions: [first, second] })).status).toBe(201);
  const retried = await send({ questions: [first, second] });
  expect(retried.status).toBe(201);
  expect(retried.body.data).toHaveLength(2);
  expect(stored).toHaveLength(2);
});

it('a changed retry cannot overwrite an existing saved question or partly add a new one', async () => {
  await send({ questions: [first] });
  const response = await send({ questions: [{ ...first, questionText: 'Changed draft' }, second] });
  expect(response.status).toBe(409);
  expect(stored).toHaveLength(1);
  expect(stored[0].content).toBe('Pick one');
});

it('a conflicting foreign ID never returns another teacher\'s question or writes a partial batch', async () => {
  stored.push({ id: firstId, created_by: 'another-teacher', content: 'Private key' });
  const response = await send({ questions: [first, second] });
  expect(response.status).toBe(409);
  expect(JSON.stringify(response.body)).not.toContain('Private key');
  expect(stored).toHaveLength(1);
});

it('database failure leaves the batch unchanged and permits the exact same retry', async () => {
  databaseFailure = true;
  expect((await send({ questions: [first, second] })).status).toBe(503);
  expect(stored).toHaveLength(0);
  databaseFailure = false;
  expect((await send({ questions: [first, second] })).status).toBe(201);
  expect(stored).toHaveLength(2);
});
