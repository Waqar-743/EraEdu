# Topics in joined private courses

An enrolled learner could join a private course by code, but its topics remained
hidden. The teacher's topic form has no separate topic publication step; course
publication was incorrectly checked again for topic counts, course permissions,
topic lists and study detail.

Enrollment now grants access to those topics whether the course is listed in the
public catalog or shared privately. Publishing still controls the public catalog.
Only the owning educator or an administrator can manage the topics. Anonymous
visitors, unenrolled learners and other educators cannot read the protected topic
list or detail. Topic practice still requires enrollment and a separately
published topic exam; its active question responses omit the answer key.

Existing learner pages refresh when focused and every 15 seconds while visible,
so newly added topics and their counts appear without signing in again.

Run the focused API regressions from `backend`:

```powershell
npm test -- --runInBand src/__tests__/enrolledTopicVisibility.test.ts src/__tests__/studentCourseTopics.test.ts src/__tests__/courseEnrollmentState.test.ts src/__tests__/topicStudyAccess.test.ts src/__tests__/topicQuizLifecycle.test.ts src/__tests__/publicCourseCatalog.test.ts
```

For the browser regression, build the backend and frontend, serve the frontend
preview on `127.0.0.1:4173`, and run from the repository root:

```powershell
node verification/enrolled-topics-browser.mjs
```

The browser check uses the compiled local Express routes, authorization middleware,
controllers and services. Only Supabase storage is replaced with isolated fixture
rows. It creates a topic through the real educator form, checks the already-open
learner course list and detail, opens study material, and verifies private catalog
exclusion plus unenrolled/revoked access denial. No production accounts, courses,
topics or databases are accessed.

Use an installed `playwright-core` module and Chrome. Set
`PLAYWRIGHT_MODULE_PATH` to its `index.mjs` if needed, `CHROME_PATH` for a different
Chrome executable, and `QA_PREVIEW_URL` for a different local preview port.
Results and screenshots are written under the ignored
`backend/coverage/enrolled-topics-browser` directory. This is local fixture
evidence; deployment still needs the resulting backend and frontend builds.
