import { config } from '../config/environment';
import { PASSWORD_RESET_EMAIL_UNAVAILABLE } from './emailDeliveryError';

export type EmailSetupStatus = 'not_configured' | 'sender_not_configured' | 'testing_sender' | 'configured';

// This reports configuration, not inbox delivery or provider/domain verification.
export function getEmailSetupStatus(): EmailSetupStatus {
  if (config.emailProvider === 'smtp') {
    const { host, port, user, pass } = config.smtp;
    // Port 25 is blocked on Vercel. Other submission ports must support TLS.
    if (!host || /[\s/]/.test(host) || !user || !pass.trim()
      || !Number.isInteger(port) || port < 1 || port > 65535 || port === 25) {
      return 'not_configured';
    }
  } else if (config.emailProvider !== 'resend' || !config.resendApiKey.trim()) {
    return 'not_configured';
  }

  const from = config.emailFrom.trim();
  if (/[\r\n]/.test(from)) return 'sender_not_configured';
  const displayAddress = from.match(/^[^<>]+<([^<>]+)>$/);
  const address = displayAddress ? displayAddress[1].trim() : from;
  const match = address.match(/^[^\s@<>]+@([^\s@<>]+\.[^\s@<>]+)$/);
  if (!match) return 'sender_not_configured';

  const domain = match[1].toLowerCase();
  if (domain === 'resend.dev' || domain.endsWith('.resend.dev')) {
    return config.emailProvider === 'smtp' ? 'sender_not_configured' : 'testing_sender';
  }
  return 'configured';
}

export function assertPasswordResetEmailConfigured(): void {
  const status = getEmailSetupStatus();
  // Resend decides whether a testing sender may reach the recipient (normally
  // only the account owner). Do not block provider-approved test deliveries.
  if (status === 'not_configured' || status === 'sender_not_configured') {
    console.error('Password recovery email configuration is incomplete:', status);
    throw Object.assign(new Error(PASSWORD_RESET_EMAIL_UNAVAILABLE), { statusCode: 503 });
  }
}
