# Pass rate after exam completion

Completed teacher-code multiple-choice exams were saved with authoritative
automatic marks and a null `teacher_grade`. Analytics treated that null as an
unavailable result, so refreshing the dashboard could not update its pass rate
until the teacher published a grade.

Aggregate scores now include completed all-MCQ exams using their immutable
attempt snapshot and persisted marks. Editing the current exam cannot change
an older attempt's classification. A valid published teacher grade, including
zero, takes precedence over automatic marks. Exams containing written answers
remain pending until a teacher publishes a final grade. Missing or malformed
legacy snapshots remain pending rather than guessing how they were marked.

The pass threshold remains 60%. Pending and active attempts do not enter its
denominator. Question-by-question results, answer keys, and feedback keep their
existing teacher-review access checks; aggregate eligibility does not release
those records. Learner and educator dashboards use the same score calculation.

## Regression checks

From `backend`:

```powershell
npm test -- --runInBand teacherResultMetrics studentResultRelease teacherStudentTotals quizAnswerNormalization
node --test scripts/verify-mcq-completion-metrics.mjs
```

The second command executes the shipped PostgreSQL start/answer/finalize
functions in an in-memory PGlite database and passes their actual completion
records to the current TypeScript metrics implementation. It verifies an MCQ
result of 2/3 contributes immediately, teacher override zero is respected, live
exam edits cannot change the snapshot, and a fully correct mixed exam still
waits for teacher grading. It runs automatically in `npm run test:database`.

With the built frontend preview at `127.0.0.1:4173`, run from the repository root:

```powershell
node verification/mcq-completion-browser.mjs
node verification/analytics-grades-browser.mjs
```

Use the separate Playwright installation and `PLAYWRIGHT_MODULE_PATH` described
in `verification/README.md`. The completion browser suite answers and submits a
fixture exam, returns through its results page, and verifies dashboard pass rate
changes without a teacher-grade request. Written-answer completion remains
pending. All API requests are intercepted; these browser checks make no real
account or database writes. Reports are stored in ignored
`backend/coverage/mcq-completion-browser`.
