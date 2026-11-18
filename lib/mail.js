/**
 * Provider-agnostic mail sender.
 * The default adapter is Resend. To swap providers, change createProvider()
 * or set MAIL_PROVIDER and add an adapter here. Nothing is sent when the
 * selected provider is not configured.
 */

function notificationRecipient() {
  return String(process.env.ORDER_NOTIFICATION_EMAIL || 'josh@soteriaservices.net').trim();
}

function inquiryRecipient() {
  return String(process.env.INQUIRY_NOTIFICATION_EMAIL || notificationRecipient()).trim();
}

function resendProvider() {
  if (!process.env.RESEND_API_KEY || !process.env.ORDER_NOTIFICATION_FROM) return null;
  return {
    name: 'resend',
    async send({ to, subject, text, html }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.ORDER_NOTIFICATION_FROM,
          to: [to],
          subject,
          text,
          html
        })
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend returned ${response.status}: ${body.slice(0, 300)}`);
      }
      return { skipped: false, provider: 'resend' };
    }
  };
}

function createProvider() {
  const choice = String(process.env.MAIL_PROVIDER || 'resend').trim().toLowerCase();
  if (choice === 'resend') return resendProvider();
  console.warn(`[mail] MAIL_PROVIDER=${choice} has no adapter. Add one in lib/mail.js. Skipping send.`);
  return null;
}

async function sendMail({ to, subject, text, html }) {
  if (!to) {
    console.warn('[mail] No recipient configured. Skipping send.');
    return { skipped: true, reason: 'recipient' };
  }
  const provider = createProvider();
  if (!provider) {
    console.warn('[mail] Email provider is not configured. Set RESEND_API_KEY and ORDER_NOTIFICATION_FROM, or add another adapter in lib/mail.js. Skipping send.');
    return { skipped: true, reason: 'provider' };
  }
  return provider.send({ to, subject, text, html });
}

module.exports = { sendMail, notificationRecipient, inquiryRecipient, createProvider };
