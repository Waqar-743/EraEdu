const mockEmailConfig = {
  nodeEnv: 'production',
  resendApiKey: 'unit-test-mail-key',
  emailFrom: 'EraEdu <recovery@mail.example.test>',
};
const mockSend = jest.fn();
jest.mock('../config/environment', () => ({ config: mockEmailConfig }));
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

import { emailService } from '../services/emailService';
import { getEmailSetupStatus } from '../services/emailConfiguration';
import { PASSWORD_RESET_EMAIL_UNAVAILABLE } from '../services/emailDeliveryError';

const recipient = 'learner@example.test';
const resetUrl = 'https://waqar-743.github.io/EraEdu/reset-password?token=private-reset-token';

beforeEach(() => {
  mockEmailConfig.nodeEnv = 'production';
  mockEmailConfig.resendApiKey = 'unit-test-mail-key';
  mockEmailConfig.emailFrom = 'EraEdu <recovery@mail.example.test>';
  mockSend.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it.each([
  ['', 'EraEdu <recovery@mail.example.test>', 'not_configured'],
  ['unit-test-mail-key', 'not-an-email', 'sender_not_configured'],
])('does not claim delivery or contact the provider when production setup is incomplete (%s)', async (key, from, status) => {
  mockEmailConfig.resendApiKey = key;
  mockEmailConfig.emailFrom = from;
  expect(getEmailSetupStatus()).toBe(status);
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  expect(mockSend).not.toHaveBeenCalled();
});

it.each(['development', 'production'])('allows provider-approved testing deliveries in %s without claiming the sender is production-ready', async environment => {
  mockEmailConfig.nodeEnv = environment;
  mockEmailConfig.emailFrom = 'EraEdu <onboarding@resend.dev>';
  mockSend.mockResolvedValue({ data: { id: 'message-1' }, error: null });
  expect(getEmailSetupStatus()).toBe('testing_sender');
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl)).resolves.toEqual({ id: 'message-1' });
});

it('sends a working plain-text and HTML recovery link using the configured sender', async () => {
  mockSend.mockResolvedValue({ data: { id: 'message-1' }, error: null });
  await emailService.sendPasswordResetEmail(recipient, '<img src=x>', resetUrl);
  expect(getEmailSetupStatus()).toBe('configured');
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
    from: mockEmailConfig.emailFrom, to: [recipient], subject: 'Reset your EraEdu password',
    text: expect.stringContaining(resetUrl), html: expect.stringContaining(`href="${resetUrl}"`),
  }));
  const email = mockSend.mock.calls[0][0];
  expect(email.html).toContain('&lt;img src=x&gt;');
  expect(email.html).not.toContain('<img src=x>');
  expect(email.html).toContain('copy this link');
});

it.each([
  { data: null, error: { name: 'validation_error', statusCode: 403, message: `Rejected ${recipient} ${resetUrl}` } },
  { data: null, error: null },
])('fails honestly if the provider rejects the email or returns no message ID', async result => {
  mockSend.mockResolvedValue(result);
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  const logs = JSON.stringify((console.error as jest.Mock).mock.calls);
  expect(logs).not.toContain(recipient);
  expect(logs).not.toContain('private-reset-token');
});

it('does not expose reset tokens or recipient data when the provider throws', async () => {
  mockSend.mockRejectedValue(new Error(`Network error ${recipient} ${resetUrl}`));
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain('private-reset-token');
});
