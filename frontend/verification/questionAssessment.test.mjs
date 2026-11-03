import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionAssessmentPayload } from '../src/services/questionAssessment.ts';

const draft = (overrides = {}) => ({
  questionTitle: '  Chapter questions  ',
  description: '',
  courseId: 'course-1',
  questionScheduledStart: '',
  cameraMonitoring: true,
  violationLimit: 3,
  questions: [],
  ...overrides,
});
const bank = [
  { _id: 'mcq-1', courseId: 'course-1', topicId: 'topic-1', questionType: 'multipleChoice', timeLimit: 90 },
  { _id: 'written-1', courseId: 'course-1', topicId: 'topic-2', questionType: 'shortAnswer', timeLimit: 60 },
  { _id: 'unused', courseId: 'course-1', topicId: 'topic-1', questionType: 'multipleChoice', timeLimit: 900 },
];

test('Question assessments can use multiple bank questions without a manual placeholder', () => {
  const payload = buildQuestionAssessmentPayload(draft(), ['written-1', 'mcq-1'], bank);
  assert.deepEqual(payload.bankQuestionIds, ['written-1', 'mcq-1']);
  assert.deepEqual(payload.questions, []);
  assert.equal(payload.timeLimit, 3);
  assert.equal(payload.title, 'Chapter questions');
  assert.equal(payload.scheduledStart, null);
  assert.equal(payload.cameraMonitoring, true);
  assert.equal(payload.violationLimit, 3);
});

test('manual questions and bank selections share the total time and preserve the schedule', () => {
  const payload = buildQuestionAssessmentPayload(draft({
    questionScheduledStart: '2026-11-10T12:00:00.000Z',
    questions: [{ text: 'Explain your reasoning', difficulty: 'Hard', explanation: 'Show your work', timeLimit: 45 }],
  }), ['mcq-1'], bank);
  assert.equal(payload.timeLimit, 3);
  assert.equal(payload.scheduledStart, '2026-11-10T12:00:00.000Z');
  assert.deepEqual(payload.questions, [{
    text: 'Explain your reasoning', options: [], correctAnswer: -1, questionType: 'shortAnswer',
    difficulty: 'Hard', explanation: 'Show your work', timeLimit: 45,
  }]);
  assert.deepEqual(payload.bankQuestionIds, ['mcq-1']);
});

test('manual-only assessments remain supported and use the default question time', () => {
  const payload = buildQuestionAssessmentPayload(draft({
    questions: [{ text: 'Define energy', difficulty: 'Easy', timeLimit: 0 }],
  }), [], bank);
  assert.equal(payload.timeLimit, 1);
  assert.equal(payload.questions[0].timeLimit, 60);
  assert.deepEqual(payload.bankQuestionIds, []);
});

test('an empty assessment and incomplete manual questions cannot be submitted', () => {
  assert.throws(() => buildQuestionAssessmentPayload(draft(), [], bank), /Add a question/);
  assert.throws(() => buildQuestionAssessmentPayload(draft({ courseId: '' }), ['mcq-1'], bank), /select a course/);
  assert.throws(() => buildQuestionAssessmentPayload(draft({ questionTitle: ' ' }), ['mcq-1'], bank), /Title is required/);
  assert.throws(() => buildQuestionAssessmentPayload(draft({
    questions: [{ text: ' ', difficulty: 'Easy', timeLimit: 60 }],
  }), ['mcq-1'], bank), /must have text/);
});

test('changing courses or losing a bank question requires a fresh selection', () => {
  assert.throws(() => buildQuestionAssessmentPayload(draft({ courseId: 'course-2' }), ['mcq-1'], bank), /unavailable for this course/);
  assert.throws(() => buildQuestionAssessmentPayload(draft(), ['deleted'], bank), /Refresh the bank/);
  assert.throws(() => buildQuestionAssessmentPayload(draft(), ['mcq-1'], [{ ...bank[0], topicId: null }]), /unavailable for this course/);
  assert.throws(() => buildQuestionAssessmentPayload(draft(), ['mcq-1', 'mcq-1'], bank), /only once/);
  assert.throws(() => buildQuestionAssessmentPayload(draft(), ['mcq-1'], [{ ...bank[0], questionType: 'unsupported' }]), /Only multiple-choice/);
});

test('later selection changes do not mutate the submitted assessment', () => {
  const ids = ['mcq-1'];
  const payload = buildQuestionAssessmentPayload(draft(), ids, bank);
  ids.push('written-1');
  assert.deepEqual(payload.bankQuestionIds, ['mcq-1']);
  assert.equal(payload.timeLimit, 2);
});
