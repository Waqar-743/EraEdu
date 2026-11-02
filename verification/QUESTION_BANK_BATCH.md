# Add several question-bank items together

The educator question bank now opens a multi-question form. Add or remove draft
cards, choose each topic and difficulty, and save up to 100 items at once.
Multiple-choice and short-answer questions can be mixed. Short answers retain
all accepted alternatives when reopened for editing. Existing filters and
single-item editing remain available.

`POST /api/questions/batch` authenticates the displayed account, permits only
teachers/admins, validates every item and checks access to every topic before
inserting. One SQL insert saves the batch atomically. Stable draft UUIDs make an
exact retry after a lost response return the same saved questions. A conflicting
edited retry returns 409 instead of overwriting saved data or adding a partial
batch. A failed response keeps the form and its values available for retry;
repeated clicks cannot submit the form concurrently. No migration is required.

From `backend`, run `npm test -- --runInBand questionBatch` for validation,
authorization, answer storage, mixed batches, database failure and retry checks.
The browser regression is `node verification/question-batch-browser.mjs` from
the repository root, using the separate Playwright/Chrome setup described in
`verification/README.md` and a local frontend at port 4173. Fixture tests do not
write to production accounts or databases.
