// Real shipped PostgreSQL start/answer/finalize functions, in memory only.
// The metrics helper is transpiled from its actual TypeScript source, so this
// suite works with the same Node 22+ runtime as the other database regressions.
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const metricSource = await readFile(new URL('../src/services/resultMetrics.ts', import.meta.url), 'utf8');
const metricModule = ts.transpileModule(metricSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { finalResultPercentage, summarizeResults } = await import(`data:text/javascript;base64,${Buffer.from(metricModule).toString('base64')}`);
const migration = await readFile(new URL('../migrations/027_teacher_attempt_deadlines.sql', import.meta.url), 'utf8');
const student = '10000000-0000-4000-8000-000000000001';
const teacher = '20000000-0000-4000-8000-000000000001';
const quiz = '30000000-0000-4000-8000-000000000001';
const course = '40000000-0000-4000-8000-000000000001';
const qid = index => `${quiz}-q${index}`;
let db;
const action = async (id, name, question = null, answers = []) => (await db.query(
  'SELECT teacher_attempt_action($1::uuid,$2::uuid,$3::text,$4::text,$5::jsonb) AS result',
  [student, id, name, question, JSON.stringify(answers)],
)).rows[0].result;
const mcq = index => ({ text: `Hidden question ${index}`, options: ['Right', 'Wrong'], correctAnswer: 0, timeLimit: 600 });

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE users (id uuid PRIMARY KEY, role text, is_suspended boolean DEFAULT false);
    CREATE TABLE courses (id uuid PRIMARY KEY, is_published boolean);
    CREATE TABLE enrollments (user_id uuid, course_id uuid);
    CREATE TABLE quizzes (id uuid PRIMARY KEY);
    CREATE TABLE teacher_quizzes (id uuid PRIMARY KEY, teacher_id text, title text,
      is_active boolean, scheduled_start timestamptz, questions jsonb, course_id uuid,
      time_limit integer, violation_limit integer);
    CREATE TABLE quiz_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
      quiz_id uuid, topic_id uuid, started_at timestamptz, completed_at timestamptz,
      status varchar(20), answers jsonb, score integer, max_score integer, teacher_grade integer,
      auto_submitted boolean DEFAULT false, submission_reason text, violation_count integer DEFAULT 0);
    CREATE TABLE cheating_violations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_attempt_id uuid, student_id uuid, quiz_id uuid, teacher_id uuid,
      violation_type text, detection_method text, severity text, details jsonb,
      timestamp timestamptz, event_id text);
    CREATE UNIQUE INDEX event_retry_identity ON cheating_violations (quiz_attempt_id,event_id) WHERE event_id IS NOT NULL;
  `);
  await db.exec(migration);
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE users, courses, enrollments, teacher_quizzes, quiz_attempts');
  await db.query('INSERT INTO users(id,role) VALUES ($1,\'student\'),($2,\'teacher\')', [student, teacher]);
  await db.query('INSERT INTO courses VALUES ($1,true)', [course]);
  await db.query('INSERT INTO enrollments VALUES ($1,$2)', [student, course]);
});
async function start(questions) {
  await db.query(`INSERT INTO teacher_quizzes(id,teacher_id,title,is_active,questions,course_id,time_limit,violation_limit)
    VALUES ($1,$2,'Immutable exam',true,$3,$4,10,99)`, [quiz, teacher, JSON.stringify(questions), course]);
  return (await db.query('SELECT start_teacher_attempt($1::uuid,$2::uuid) AS result', [student, quiz])).rows[0].result;
}

test('real MCQ completion changes pass rate immediately; pending feedback and teacher overrides preserve immutable marks', async () => {
  const started = await start([mcq(0), mcq(1), mcq(2)]);
  assert.equal(finalResultPercentage(started), null);
  for (let index = 0; index < 3; index++) await action(started.id, 'activate', qid(index));
  await action(started.id, 'answer', null, [0, 1, 2].map(index => ({
    questionId: qid(index), selectedAnswer: index < 2 ? 0 : 1, isCorrect: false, questionType: 'multipleChoice', answerVersion: 2,
  })));
  const completed = await action(started.id, 'submit');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.score, 2);
  assert.equal(completed.max_score, 3);
  assert.equal(completed.teacher_grade, null);
  const summary = summarizeResults([completed]);
  assert.equal(summary.avgScore, 66.7);
  assert.equal(summary.passRate, 100);
  assert.equal(summary.pendingReviews, 0);
  assert.doesNotMatch(JSON.stringify(summary), /Hidden question|correctAnswer|teacher_quiz_snapshot/);
  await db.query('UPDATE teacher_quizzes SET questions=$1 WHERE id=$2', [JSON.stringify([{ questionType: 'shortAnswer', options: [] }]), quiz]);
  assert.equal(summarizeResults([await action(started.id, 'read')]).avgScore, 66.7);
  assert.equal((await action(started.id, 'submit')).newlyCompleted, false);
  await db.query('UPDATE quiz_attempts SET teacher_grade=0 WHERE id=$1', [started.id]);
  const adjusted = await action(started.id, 'read');
  assert.equal(adjusted.score, 2);
  assert.equal(summarizeResults([adjusted]).passRate, 0);
  assert.equal(summarizeResults([adjusted]).avgScore, 0);
});

test('real mixed-exam completion remains pending despite a correct exact-match written response', async () => {
  const started = await start([mcq(0), { text: 'Hidden written question', options: [], questionType: 'shortAnswer', answerText: 'secret', timeLimit: 600 }]);
  await action(started.id, 'activate', qid(0));
  await action(started.id, 'activate', qid(1));
  await action(started.id, 'answer', null, [
    { questionId: qid(0), selectedAnswer: 0, isCorrect: false, questionType: 'multipleChoice', answerVersion: 2 },
    { questionId: qid(1), selectedAnswer: 'secret', isCorrect: false, questionType: 'shortAnswer', answerVersion: 2 },
  ]);
  const completed = await action(started.id, 'submit');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.score, 2);
  assert.equal(completed.max_score, 2);
  assert.equal(finalResultPercentage(completed), null);
  assert.equal(summarizeResults([completed]).passRate, null);
  assert.equal(summarizeResults([completed]).pendingReviews, 1);
  await db.query('UPDATE quiz_attempts SET teacher_grade=75 WHERE id=$1', [started.id]);
  assert.equal(summarizeResults([await action(started.id, 'read')]).avgScore, 75);
  assert.equal(summarizeResults([await action(started.id, 'read')]).passRate, 100);
});
