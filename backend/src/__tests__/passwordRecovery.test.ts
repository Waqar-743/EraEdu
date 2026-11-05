process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-ok';
process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
process.env.SUPABASE_KEY = 'placeholder-anon-key';
process.env.FRONTEND_URL = 'https://waqar-743.github.io/EraEdu';
process.env.RESEND_API_KEY = 'unit-test-mail-key';
process.env.EMAIL_FROM = 'EraEdu <recovery@mail.example.test>';

const mockFrom = jest.fn();
const mockResetEmail = jest.fn();
jest.mock('../config/supabase', () => ({ supabase: { from: mockFrom } }));
jest.mock('../services/emailService', () => ({ emailService: { sendPasswordResetEmail: mockResetEmail } }));

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment';
import { authService } from '../services/authService';
import { PASSWORD_RESET_EMAIL_UNAVAILABLE } from '../services/emailDeliveryError';

const account = { id: 'learner-1', email: 'learner@example.test', name: 'Amina' };
type Write = { values: Record<string, unknown>; filters: [string, unknown][] };

function setup({ users = [account] as any[], writeError = null as any } = {}) {
  const writes: Write[] = [];
  const lookups: [string, unknown][] = [];
  const query: any = {
    select: () => query,
    eq: (field: string, value: unknown) => { lookups.push([field, value]); return query; },
    gt: () => query,
    limit: async () => ({ data: users, error: null }),
    update: (values: Record<string, unknown>) => {
      const write: Write = { values, filters: [] };
      writes.push(write);
      const update: any = {
        eq: (field: string, value: unknown) => { write.filters.push([field, value]); return update; },
        then: (resolve: any, reject: any) => Promise.resolve({ error: writeError }).then(resolve, reject),
      };
      return update;
    },
  };
  mockFrom.mockReturnValue(query);
  return { writes, lookups };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockResetEmail.mockReset().mockResolvedValue({ id: 'message-1' });
  config.emailProvider = 'resend';
  config.resendApiKey = 'unit-test-mail-key';
  config.emailFrom = 'EraEdu <recovery@mail.example.test>';
  config.frontendAppUrl = 'https://waqar-743.github.io/EraEdu';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('stores only a token hash and sends an expiring link to the correct frontend app path', async () => {
  const { writes, lookups } = setup();
  const started = Date.now();
  const result = await authService.requestPasswordReset('  LEARNER@EXAMPLE.TEST  ');
  expect(lookups).toContainEqual(['email', account.email]);
  const [email, name, resetUrl] = mockResetEmail.mock.calls[0];
  expect([email, name]).toEqual([account.email, account.name]);
  const link = new URL(resetUrl);
  expect(link.origin + link.pathname).toBe('https://waqar-743.github.io/EraEdu/reset-password');
  const token = link.searchParams.get('token')!;
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(writes[0].values.reset_password_token).toBe(crypto.createHash('sha256').update(token).digest('hex'));
  expect(Date.parse(String(writes[0].values.reset_password_expires_at))).toBeGreaterThanOrEqual(started + 3600000);
  expect(JSON.stringify(result)).not.toContain(token);
  expect(JSON.stringify(result)).not.toContain(account.email);
});

it('uses the same success response for an unknown account without sending any email', async () => {
  setup();
  const registered = await authService.requestPasswordReset(account.email);
  mockResetEmail.mockClear();
  const { writes } = setup({ users: [] });
  await expect(authService.requestPasswordReset('unknown@example.test')).resolves.toEqual(registered);
  expect(mockResetEmail).not.toHaveBeenCalled();
  expect(writes).toHaveLength(0);
});

it('creates a recovery link on the free Vercel frontend when using SMTP without Resend', async () => {
  setup();
  config.emailProvider = 'smtp';
  config.resendApiKey = '';
  config.smtp = { host: 'smtp.gmail.com', port: 465, user: 'sender@gmail.com', pass: 'unit-test-app-password' };
  config.emailFrom = 'EraEdu <sender@gmail.com>';
  config.frontendAppUrl = 'https://era-edu-mtoc.vercel.app';
  await authService.requestPasswordReset(account.email);
  const link = new URL(mockResetEmail.mock.calls[0][2]);
  expect(link.origin + link.pathname).toBe('https://era-edu-mtoc.vercel.app/reset-password');
  expect(link.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
});

it('reports missing email setup before account lookup or token creation', async () => {
  config.resendApiKey = '';
  await expect(authService.requestPasswordReset(account.email))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockResetEmail).not.toHaveBeenCalled();
});

it('does not send a link if the token could not be stored', async () => {
  setup({ writeError: { message: 'database unavailable' } });
  await expect(authService.requestPasswordReset(account.email)).rejects.toThrow();
  expect(mockResetEmail).not.toHaveBeenCalled();
});

it('rejects failed delivery and clears only its own undelivered token', async () => {
  const { writes } = setup();
  mockResetEmail.mockRejectedValue(Object.assign(new Error(PASSWORD_RESET_EMAIL_UNAVAILABLE), { statusCode: 503 }));
  await expect(authService.requestPasswordReset(account.email)).rejects.toMatchObject({ statusCode: 503 });
  expect(writes).toHaveLength(2);
  expect(writes[1].values).toEqual({ reset_password_token: null, reset_password_expires_at: null });
  expect(writes[1].filters).toEqual([['id', account.id], ['reset_password_token', writes[0].values.reset_password_token]]);
});

it('rejects an expired or already consumed reset link', async () => {
  const { writes } = setup({ users: [] });
  await expect(authService.resetPassword('expired-token', 'UpdatedPassword2')).rejects.toMatchObject({ statusCode: 400 });
  expect(writes).toHaveLength(0);
});

it('stores a password hash and consumes a valid reset token', async () => {
  const { writes, lookups } = setup();
  await expect(authService.resetPassword('valid-token', 'UpdatedPassword2')).resolves.toMatchObject({ message: expect.stringContaining('Password reset successful') });
  expect(lookups).toContainEqual(['reset_password_token', crypto.createHash('sha256').update('valid-token').digest('hex')]);
  expect(await bcrypt.compare('UpdatedPassword2', String(writes[0].values.password))).toBe(true);
  expect(writes[0].values).toMatchObject({ reset_password_token: null, reset_password_expires_at: null });
});
