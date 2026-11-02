// Actual question-bank UI with isolated API fixtures; no live questions changed.
// Serve the frontend on QA_PREVIEW_URL (default http://127.0.0.1:4173).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright-core');
const base = process.env.QA_PREVIEW_URL || 'http://127.0.0.1:4173';
const output = path.resolve('backend/coverage/question-batch-browser');
await mkdir(output, { recursive: true });
const teacher = { _id: 'current-teacher', name: 'Current Teacher', email: 'teacher@example.invalid', role: 'teacher' };
const topics = [
  { _id: '10000000-0000-4000-8000-000000000001', title: 'First topic', courseName: 'Assigned course' },
  { _id: '10000000-0000-4000-8000-000000000002', title: 'Second topic', courseName: 'Assigned course' },
];
const reassignedId = '20000000-0000-4000-8000-000000000001';
const rows = [{ _id: reassignedId, text: 'Reassigned short answer', topicId: topics[0]._id,
  topicName: topics[0].title, courseName: 'Assigned course', createdBy: 'previous-teacher',
  options: [], correctAnswer: null, correctAnswers: ['Alternative one', 'Alternative two'], answerText: 'Alternative one',
  questionType: 'shortAnswer', difficulty: 'Hard', explanation: 'Original explanation' }];
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, serviceWorkers: 'block' });
const writes = [], updates = [], unknown = [], errors = [];
let standaloneOnly = false;
let releaseFirst, startedFirst;
const firstGate = new Promise(resolve => { releaseFirst = resolve; });
const firstStarted = new Promise(resolve => { startedFirst = resolve; });
const success = data => ({ success: true, data });

await context.route('**/api/**', async route => {
  const request = route.request();
  const endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
  const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
  if (endpoint === '/auth/me') return reply(success(teacher));
  if (endpoint === '/notifications') return reply(success([]));
  if (endpoint === '/courses/teacher/topics') return reply(success(standaloneOnly ? [] : topics));
  if (endpoint === '/courses/teacher/questions') return reply(success(standaloneOnly ? rows.filter(row => !row.topicId) : rows));
  if (endpoint === '/questions/batch' && request.method() === 'POST') {
    const body = request.postDataJSON();
    writes.push(structuredClone(body));
    if (writes.length === 1) {
      for (const question of body.questions) rows.push({
        _id: question.id, text: question.questionText, topicId: question.topicId,
        topicName: topics.find(topic => topic._id === question.topicId).title, courseName: 'Assigned course',
        options: question.options, correctAnswer: question.questionType === 'shortAnswer' ? null : question.correctAnswer,
        correctAnswers: question.correctAnswers, questionType: question.questionType,
        difficulty: question.difficulty, explanation: question.explanation, createdBy: teacher._id,
      });
      startedFirst();
      await firstGate;
      return route.abort('connectionreset'); // The write committed, but its response was lost.
    }
    assert.deepEqual(body, writes[0], 'An unchanged retry retains every draft field and UUID');
    return reply(success(body.questions.map(question => rows.find(row => row._id === question.id))), 201);
  }
  if (endpoint.startsWith('/courses/questions/') && request.method() === 'PUT') {
    const body = request.postDataJSON();
    updates.push(body);
    const row = rows.find(row => row._id === endpoint.split('/').at(-1));
    assert.ok(row, 'Only known question IDs can be edited');
    Object.assign(row, { text: body.text, options: body.options, correctAnswer: body.correctAnswer,
      correctAnswers: body.correctAnswers, answerText: body.correctAnswers[0], questionType: body.questionType,
      difficulty: body.difficulty, explanation: body.explanation });
    return reply(success(row));
  }
  unknown.push(`${request.method()} ${endpoint}`);
  return reply({ success: false, message: 'Unexpected question-bank fixture request' }, 500);
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror', error => errors.push(error.message));
const group = index => page.getByRole('dialog').getByRole('group', { name: `Question ${index}`, exact: true });

async function fillMcq(index, text, topicId, difficulty, correctIndex) {
  const question = group(index);
  await question.getByLabel(/^Question text/).fill(text);
  await question.getByRole('combobox').nth(0).selectOption(topicId);
  await question.getByRole('combobox').nth(2).selectOption(difficulty);
  for (let option = 0; option < 4; option++) await question.getByRole('textbox', { name: `Option ${option + 1}`, exact: true }).fill(`${text} answer ${option + 1}`);
  await question.getByRole('radio', { name: `Correct option ${correctIndex + 1}`, exact: true }).check();
}

let report;
try {
  await page.goto(`${base}/dashboard/teacher/questions`);
  await page.getByText('Reassigned short answer', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add Questions', exact: true }).click();
  await fillMcq(1, 'Batch first MCQ', topics[0]._id, 'Easy', 2);
  await page.getByRole('button', { name: 'Add another question', exact: true }).click();
  await group(2).getByRole('combobox').nth(1).selectOption('shortAnswer');
  await group(2).getByRole('combobox').nth(0).selectOption(topics[1]._id);
  await group(2).getByRole('combobox').nth(2).selectOption('Hard');
  await group(2).getByLabel(/^Question text/).fill('Batch short answer');
  await group(2).getByLabel(/^Accepted answers/).fill('Alpha\nBeta');
  await page.getByRole('button', { name: 'Add another question', exact: true }).click();
  await group(3).getByLabel(/^Question text/).fill('Removed draft must not save');
  await page.getByRole('button', { name: 'Remove question 3', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('group', { name: 'Question 3', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Add another question', exact: true }).click();
  await fillMcq(3, 'Batch last MCQ', topics[1]._id, 'Medium', 0);
  await page.getByRole('dialog').evaluate(dialog => { dialog.parentElement.scrollTop = 0; });
  await page.screenshot({ path: path.join(output, 'mixed-question-drafts.png') });
  const save = page.getByRole('button', { name: 'Save 3 questions', exact: true });
  await save.click();
  await firstStarted;
  assert.equal(await page.getByRole('button', { name: 'Saving…', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).isDisabled(), true);
  // A second submit event in the same pending save must not dispatch a second POST.
  await page.getByRole('dialog').locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].questions.length, 3);
  assert.equal(new Set(writes[0].questions.map(question => question.id)).size, 3);
  assert.deepEqual(writes[0].questions.map(question => question.questionType), ['multipleChoice', 'shortAnswer', 'multipleChoice']);
  assert.equal(writes[0].questions[0].correctAnswer, 2);
  assert.deepEqual(writes[0].questions[1].correctAnswers, ['Alpha', 'Beta']);
  assert.equal(writes[0].questions[2].correctAnswer, 0);
  assert.ok(!writes[0].questions.some(question => question.questionText.includes('Removed draft')));
  releaseFirst();
  await page.getByRole('alert').filter({ hasText: 'Your draft is unchanged' }).waitFor();
  assert.equal(await group(1).getByLabel(/^Question text/).inputValue(), 'Batch first MCQ');
  assert.equal(await group(2).getByLabel(/^Accepted answers/).inputValue(), 'Alpha\nBeta');
  await save.click();
  await page.getByText('3 questions saved.', { exact: true }).waitFor();
  await page.getByText('Batch last MCQ', { exact: true }).waitFor();
  assert.equal(writes.length, 2);
  assert.equal(rows.length, 4, 'A lost-response retry did not append duplicates');

  await page.getByPlaceholder('Search questions...').fill('Batch');
  assert.equal(await page.locator('tbody tr').count(), 3);
  await page.getByRole('combobox').nth(0).selectOption(topics[1]._id);
  assert.equal(await page.locator('tbody tr').count(), 2);
  await page.getByRole('combobox').nth(1).selectOption('hard');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByPlaceholder('Search questions...').fill('no matching question');
  await page.getByText('No questions found.', { exact: false }).waitFor();
  await page.getByRole('combobox').nth(0).selectOption('all');
  await page.getByRole('combobox').nth(1).selectOption('all');
  await page.getByPlaceholder('Search questions...').fill('Reassigned short answer');
  const reassignedRow = page.getByRole('row').filter({ hasText: 'Reassigned short answer' });
  await reassignedRow.getByTitle('Edit', { exact: true }).click();
  assert.equal(await group(1).getByRole('combobox').nth(0).isDisabled(), true);
  assert.equal(await group(1).getByLabel(/^Accepted answers/).inputValue(), 'Alternative one\nAlternative two');
  await group(1).getByLabel(/^Question text/).fill('Reassigned short answer revised');
  await page.getByRole('button', { name: 'Update question', exact: true }).click();
  await page.getByText('Question updated.', { exact: true }).waitFor();
  await page.getByText('Reassigned short answer revised', { exact: true }).waitFor();
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].correctAnswers, ['Alternative one', 'Alternative two']);
  assert.equal(updates[0].correctAnswer, null);
  assert.equal(updates[0].text, 'Reassigned short answer revised');
  await page.getByRole('row').filter({ hasText: 'Reassigned short answer revised' }).getByTitle('Edit', { exact: true }).click();
  assert.equal(await group(1).getByLabel(/^Accepted answers/).inputValue(), 'Alternative one\nAlternative two');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  // Existing direct questions remain editable even when the teacher has no topics.
  standaloneOnly = true;
  rows.push({ _id: '20000000-0000-4000-8000-000000000002', text: 'Standalone short answer', topicId: null,
    topicName: 'Standalone', options: [], correctAnswer: null, correctAnswers: ['Standalone answer', 'Standalone alternative'],
    answerText: 'Standalone answer', questionType: 'shortAnswer', difficulty: 'Easy', createdBy: teacher._id });
  await page.reload();
  await page.getByText('Standalone short answer', { exact: true }).waitFor();
  await page.getByRole('row').filter({ hasText: 'Standalone short answer' }).getByTitle('Edit', { exact: true }).click();
  assert.equal(await group(1).getByRole('textbox', { name: 'Topic', exact: true }).inputValue(), 'Standalone');
  assert.equal(await group(1).getByRole('textbox', { name: 'Topic', exact: true }).evaluate(input => input.readOnly), true);
  await group(1).getByLabel(/^Question text/).fill('Standalone short answer revised');
  await page.getByRole('button', { name: 'Update question', exact: true }).click();
  await page.getByText('Standalone short answer revised', { exact: true }).waitFor();
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1].correctAnswers, ['Standalone answer', 'Standalone alternative']);
  assert.deepEqual(unknown, []);
  assert.deepEqual(errors, []);
  report = { status: 'PASS', checks: ['mixed MCQ/short-answer batch', 'remove and add drafts', 'one POST per save',
    'pending double-submit guard', 'lost-response exact UUID retry', 'no duplicate rows', 'search/topic/difficulty filters',
    'assigned-course edit route', 'short-answer alternatives survive update and reopen', 'standalone edit with no topics'] };
} catch (error) {
  report = { status: 'FAIL', error: error.stack || String(error) };
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
} finally { releaseFirst(); await browser.close(); }
await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
