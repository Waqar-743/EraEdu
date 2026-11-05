# Password recovery email setup

Password recovery can send through an existing mailbox using SMTP, or through
Resend. A free `vercel.app` website address works as the reset-link destination;
buying a domain is unnecessary when using an authorized Gmail sender over SMTP.

The backend creates a random reset token, stores only its SHA-256 hash, and sends
a link valid for one hour. A successful response for a registered account means
the selected mail server accepted the message, not that it reached the inbox.
Unknown accounts receive the same generic response without an email.

## Option A: Gmail / SMTP without a custom domain

The owner of the backend Vercel project must add these settings under
**Settings > Environment Variables**, for **Production**, then redeploy the
latest `main` commit. Pushing to GitHub alone does not supply sending credentials.

1. Choose a Gmail account you own for sending recovery emails. It can differ from
   the registered address receiving a reset.
2. Enable two-step verification and create a Google App Password for ERA EDU.
   Use that app password, not the normal account password. Some school/work or
   protected accounts do not offer app passwords; use an account that allows
   them. See [Google's app-password instructions](https://support.google.com/accounts/answer/185833).
3. Set these backend variables privately:

   | Variable | Value |
   | --- | --- |
   | `EMAIL_PROVIDER` | `smtp` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | The full sending Gmail address |
   | `SMTP_PASS` | Its Google App Password, entered without Google's display-grouping spaces |
   | `EMAIL_FROM` | `EraEdu <your-sending-address@gmail.com>`, matching the sending mailbox |
   | `FRONTEND_URL` | `https://era-edu-mtoc.vercel.app` if this is the intended frontend |

   Replace the example sender with the real account. If `EMAIL_FROM` is absent,
   SMTP defaults to `EraEdu <SMTP_USER>`. Remove or replace an existing
   `onboarding@resend.dev` value when switching to SMTP. A Resend API key is not
   needed for SMTP password recovery.
4. Ensure `backend/migrations/004_add_password_reset_columns.sql` is applied.
5. Redeploy the **backend**, not only the frontend.

For another SMTP provider, use its authorized sender, server, login, and password.
Port 465 uses TLS immediately; other submission ports, including 587, require
STARTTLS before authentication. Port 25 is rejected because Vercel blocks it.
TLS certificate checks remain enabled, and SMTP debugging is disabled to protect
credentials and reset tokens. See [Vercel's SMTP guidance](https://vercel.com/kb/guide/serverless-functions-and-smtp).

`EMAIL_PROVIDER` currently selects password recovery delivery. Existing welcome,
enrollment, and student sign-in-code emails continue to use Resend.

## Option B: Resend with a verified domain

1. Verify a sending domain you own in [Resend Domains](https://resend.com/domains).
2. In the backend Vercel project's **Production** environment, set:
   - `EMAIL_PROVIDER=resend` (also the default when omitted).
   - `RESEND_API_KEY`: your server-side Resend API key.
   - `EMAIL_FROM`: a sender on that verified domain, such as `EraEdu <no-reply@your-verified-domain>`.
   - `FRONTEND_URL`: the intended frontend app URL.
3. Apply migration 004 if needed, then redeploy the backend.

The shared `resend.dev` domain only sends tests to the address associated with
the Resend account. It cannot send recovery messages to other users. See
[Resend's sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Frontend URL and setup status

Use `https://era-edu-mtoc.vercel.app` for the Vercel frontend, or
`https://waqar-743.github.io/EraEdu` for GitHub Pages. Preserve `/EraEdu` for Pages.
`FRONTEND_URL` also controls payment return links, so choose the intended frontend
for both flows. Never put mail credentials in frontend variables or repository files.

The backend `/health` endpoint includes `checks.email`:

- `not_configured`: the provider is unknown or its required credentials/server/port are missing or invalid.
- `sender_not_configured`: the sender is invalid, or a Resend testing sender was selected for SMTP.
- `testing_sender`: Resend's restricted testing domain is configured.
- `configured`: the selected provider has the required settings and a valid sender format.

These statuses check configuration only. They do not test passwords, verify a
Resend domain, connect to SMTP, or confirm delivery.

## Manual verification

1. After backend redeployment, open the intended frontend's **Forgot password** page.
2. Enter the email address of an existing ERA EDU account and submit once.
3. Confirm the page shows success. If the server rejects the message, the page
   shows an error and the undelivered reset token is cleared.
4. Check the recipient's inbox and spam folder. With Resend, also inspect the
   matching delivery event for rejection, bounce, or suppression.
5. Open the link and confirm it uses the chosen frontend URL. Choose a new
   password, then sign in with it. The previous password should fail.
6. Try the same reset link again; it should be invalid. An expired link should
   also require a new request.

Never publish reset links, passwords, or API keys in logs, screenshots, or chat.
