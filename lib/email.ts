import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const resend = getResend();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  await resend.emails.send({
    from: process.env.EMAIL_FROM || `Doc Expert <noreply@${appUrl.replace('https://', '').replace('http://', '')}>`,
    to: [email],
    subject: 'Reset your Doc Expert password',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your Doc Expert account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
    `,
  });
}
