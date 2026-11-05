const mockEmailConfig = {
  nodeEnv: 'production',
  emailProvider: 'resend',
  resendApiKey: 'unit-test-mail-key',
  emailFrom: 'EraEdu <recovery@mail.example.test>',
  smtp: { host: 'smtp.gmail.com', port: 465, user: 'sender@gmail.com', pass: 'unit-test-app-password' },
};
const mockSend = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();
jest.mock('../config/environment', () => ({ config: mockEmailConfig }));
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));
jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));

import { emailService } from '../services/emailService';
import { getEmailSetupStatus } from '../services/emailConfiguration';
import { PASSWORD_RESET_EMAIL_UNAVAILABLE } from '../services/emailDeliveryError';

const recipient = 'learner@example.test';
const resetUrl = 'https://waqar-743.github.io/EraEdu/reset-password?token=private-reset-token';

beforeEach(() => {
  mockEmailConfig.nodeEnv = 'production';
  mockEmailConfig.emailProvider = 'resend';
  mockEmailConfig.resendApiKey = 'unit-test-mail-key';
  mockEmailConfig.emailFrom = 'EraEdu <recovery@mail.example.test>';
  mockEmailConfig.smtp = { host: 'smtp.gmail.com', port: 465, user: 'sender@gmail.com', pass: 'unit-test-app-password' };
  mockSend.mockReset();
  mockSendMail.mockReset();
  mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail });
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

it.each([465, 587])('sends through SMTP with encrypted submission on port %s without a Resend key or custom domain', async port => {
  mockEmailConfig.emailProvider = 'smtp';
  mockEmailConfig.resendApiKey = '';
  mockEmailConfig.emailFrom = 'EraEdu <sender@gmail.com>';
  mockEmailConfig.smtp.port = port;
  mockSendMail.mockResolvedValue({ messageId: 'smtp-message-1', accepted: [recipient], rejected: [] });

  expect(getEmailSetupStatus()).toBe('configured');
  await expect(emailService.sendPasswordResetEmail(recipient, '<Amina>', resetUrl))
    .resolves.toEqual({ id: 'smtp-message-1' });
  expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: 'smtp.gmail.com', port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: 'sender@gmail.com', pass: 'unit-test-app-password' },
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  }));
  expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
    from: 'EraEdu <sender@gmail.com>', to: [recipient],
    text: expect.stringContaining(resetUrl), html: expect.stringContaining('&lt;Amina&gt;'),
  }));
  expect(mockSend).not.toHaveBeenCalled();
});

it.each([
  { host: '' }, { host: 'https://smtp.gmail.com' }, { user: '' }, { pass: '' },
  { port: 25 }, { port: Number.NaN }, { port: 65536 },
])('rejects incomplete or unusable SMTP setup before sending: %p', async settings => {
  mockEmailConfig.emailProvider = 'smtp';
  Object.assign(mockEmailConfig.smtp, settings);
  expect(getEmailSetupStatus()).toBe('not_configured');
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  expect(mockCreateTransport).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

it('rejects an unknown provider instead of silently choosing another service', async () => {
  mockEmailConfig.emailProvider = 'smtpp';
  expect(getEmailSetupStatus()).toBe('not_configured');
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl)).rejects.toMatchObject({ statusCode: 503 });
  expect(mockCreateTransport).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

it.each(['EraEdu <onboarding@resend.dev>', 'EraEdu\r\nBcc: other@example.test <sender@gmail.com>'])(
  'rejects an unusable SMTP sender: %s', async sender => {
    mockEmailConfig.emailProvider = 'smtp';
    mockEmailConfig.emailFrom = sender;
    expect(getEmailSetupStatus()).toBe('sender_not_configured');
    await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl)).rejects.toMatchObject({ statusCode: 503 });
    expect(mockCreateTransport).not.toHaveBeenCalled();
  },
);

it.each([
  { messageId: 'local-message-id', accepted: [], rejected: [recipient] },
  { messageId: 'local-message-id', accepted: ['other@example.test'] },
  { accepted: [recipient] },
])('does not claim SMTP delivery without acceptance for the requested recipient', async result => {
  mockEmailConfig.emailProvider = 'smtp';
  mockSendMail.mockResolvedValue(result);
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  expect(mockSend).not.toHaveBeenCalled();
});

it('keeps SMTP credentials and reset tokens out of errors and does not retry with Resend', async () => {
  mockEmailConfig.emailProvider = 'smtp';
  mockSendMail.mockRejectedValue(new Error(`${mockEmailConfig.smtp.pass}: ${recipient} ${resetUrl}`));
  await expect(emailService.sendPasswordResetEmail(recipient, 'Amina', resetUrl))
    .rejects.toMatchObject({ statusCode: 503, message: PASSWORD_RESET_EMAIL_UNAVAILABLE });
  const logs = JSON.stringify((console.error as jest.Mock).mock.calls);
  expect(logs).not.toContain(mockEmailConfig.smtp.pass);
  expect(logs).not.toContain(recipient);
  expect(logs).not.toContain('private-reset-token');
  expect(mockSend).not.toHaveBeenCalled();
});
