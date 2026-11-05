import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { config } from '../config/environment';
import { assertPasswordResetEmailConfigured } from './emailConfiguration';
import { PASSWORD_RESET_EMAIL_UNAVAILABLE } from './emailDeliveryError';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!config.resendApiKey) {
      throw new Error('Resend API key is not configured.');
    }
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

function getSmtp() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    requireTLS: config.smtp.port !== 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
}

export const emailService = {
  async sendWelcomeEmail(email: string, name: string) {
    if (!config.resendApiKey) {
        console.warn('Resend API Key is missing. Email not sent.');
        return null;
    }
    try {
      const data = await getResend().emails.send({
        from: 'Adaptive Learning <onboarding@resend.dev>', // Use 'onboarding@resend.dev' for testing if you don't have a domain
        to: [email],
        subject: 'Welcome to Adaptive Learning Platform!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, ${name}!</h2>
            <p>We are thrilled to have you on board. Get ready to experience a personalized learning journey powered by AI.</p>
            <p>Here are a few things you can do to get started:</p>
            <ul>
              <li>Explore our adaptive courses</li>
              <li>Take an exam to test your knowledge</li>
              <li>Check your personalized dashboard</li>
            </ul>
            <p>Happy Learning!</p>
            <p>The Adaptive Learning Team</p>
          </div>
        `,
      });

      return data;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error to prevent blocking the registration process
      return null;
    }
  },

  async sendCourseEnrollmentEmail(email: string, name: string, courseTitle: string) {
    if (!config.resendApiKey) return null;
    try {
      const data = await getResend().emails.send({
        from: 'Adaptive Learning <onboarding@resend.dev>',
        to: [email],
        subject: `Enrolled in: ${courseTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>You have successfully enrolled in <strong>${courseTitle}</strong>.</p>
            <p>We wish you the best of luck in your studies!</p>
            <p>The Adaptive Learning Team</p>
          </div>
        `,
      });
      return data;
    } catch (error) {
      console.error('Error sending enrollment email:', error);
      return null;
    }
  },

  async sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
    assertPasswordResetEmailConfigured();

    try {
      const message = {
        from: config.emailFrom,
        to: [email],
        subject: 'Reset your EraEdu password',
        text: `Hello ${name},\n\nWe received a request to reset your EraEdu password.\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${escapeHtml(name)},</h2>
            <p>We received a request to reset your EraEdu password.</p>
            <p>
              <a
                href="${escapeHtml(resetUrl)}"
                style="display: inline-block; padding: 12px 20px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px;"
              >
                Reset Password
              </a>
            </p>
            <p>If the button does not open, copy this link into your browser:</p>
            <p style="word-break: break-all;">${escapeHtml(resetUrl)}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
          </div>
        `,
      };

      if (config.emailProvider === 'smtp') {
        const result = await getSmtp().sendMail(message);
        const recipientAccepted = result.accepted?.some(address =>
          address.toLowerCase() === email.toLowerCase());
        // A locally generated message ID alone does not confirm SMTP acceptance.
        if (!result.messageId || !recipientAccepted) {
          throw new Error('SMTP server did not accept the reset message.');
        }
        return { id: result.messageId };
      }

      const { data, error } = await getResend().emails.send(message);

      // The Resend SDK reports many delivery failures in its `error` result
      // instead of rejecting the promise. Do not claim the reset link was
      // sent when the provider rejected it.
      if (error || !data?.id) {
        console.error('Password reset email was not accepted by the provider:', {
          name: error?.name || 'missing_message_id',
          statusCode: error?.statusCode,
        });
        throw new Error('Email provider did not accept the reset message.');
      }

      return data;
    } catch (error) {
      // Do not log the message, recipient or reset URL, which contains a secret.
      console.error('Password reset email delivery failed:', error instanceof Error ? error.name : 'Error');
      throw Object.assign(new Error(PASSWORD_RESET_EMAIL_UNAVAILABLE), { statusCode: 503 });
    }
  },
  async sendStudentLoginOtp(email: string, name: string, code: string) {
    if (!config.resendApiKey) {
      throw Object.assign(new Error('Email verification is not configured. Please contact support.'), { statusCode: 503 });
    }
    try {
      await getResend().emails.send({
        from: config.emailFrom,
        to: [email],
        subject: 'Your EraEdu sign-in code',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>Hello ${name},</h2><p>Use this code to sign in to EraEdu:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p></div>`,
      });
    } catch {
      throw Object.assign(new Error('Unable to send your sign-in code. Please try again.'), { statusCode: 503 });
    }
  },
};
