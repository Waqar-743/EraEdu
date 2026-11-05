# Password recovery email setup

The frontend submits the registered email to `/api/auth/forgot-password`.
The backend stores a SHA-256 hash of a random token and sends its one-hour
reset link through Resend. A successful API response means Resend accepted
the email; inbox placement still depends on the receiving mail provider.

## Configure the backend on Vercel

1. Verify a sending domain you own in [Resend Domains](https://resend.com/domains).
2. In the backend Vercel project's **Production** environment, set:
   - `RESEND_API_KEY`: your server-side Resend API key.
   - `EMAIL_FROM`: a sender on that verified domain, such as `EraEdu <no-reply@your-verified-domain>`.
   - `FRONTEND_URL`: `https://waqar-743.github.io/EraEdu` when this is the canonical frontend. This value also controls payment return links, so use the intended frontend for both flows.
3. Ensure migration `backend/migrations/004_add_password_reset_columns.sql` is applied.
4. Redeploy the backend. Pushing frontend changes to GitHub Pages alone does not update Vercel's runtime environment.
5. Read the backend `/health` endpoint. Its `checks.email` field reports:
   - `not_configured`: the Resend API key is missing.
   - `sender_not_configured`: the sender address is invalid.
   - `testing_sender`: the shared Resend testing domain is still configured.
   - `configured`: credentials and a custom sender are present. This does not verify the key, domain, or inbox delivery.

The shared `resend.dev` domain can only send development tests to the address
associated with the Resend account. For real users, use a verified custom
domain. See [Resend's sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## Verify delivery

Request a reset for an existing account and inspect the matching Resend email
event. Confirm it was delivered rather than rejected, bounced, or suppressed,
then check the recipient's inbox and spam folder. Open the link and confirm
that it points to the intended frontend, preserves `/EraEdu`, and allows one
password reset before expiry. Never publish a reset link or API key in logs,
screenshots, repository files, or chat.

Unknown email addresses receive the same generic success message as registered
accounts. Mail configuration failures are reported before account lookup, and
provider failures return a clear error instead of claiming the email was sent.
