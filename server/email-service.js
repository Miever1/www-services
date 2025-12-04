// Email service using SendGrid API
// For SMTP alternative, see email-service-smtp.js

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@handygo.com';
const SENDGRID_FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') || 'HandyGO';

// Alternative: SMTP configuration
const SMTP_HOST = Deno.env.get('SMTP_HOST');
const SMTP_PORT = Deno.env.get('SMTP_PORT') || '587';
const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
const SMTP_FROM_EMAIL = Deno.env.get('SMTP_FROM_EMAIL') || SMTP_USER;

// Check which email service to use
const USE_SENDGRID = !!SENDGRID_API_KEY;
const USE_SMTP = !!SMTP_HOST && !!SMTP_USER && !!SMTP_PASSWORD;

/**
 * Send email using SendGrid API
 */
async function sendEmailViaSendGrid(to, subject, html, text) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
        subject: subject,
      }],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      content: [
        {
          type: 'text/plain',
          value: text || html.replace(/<[^>]*>/g, ''),
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  const responseText = await response.text();
  console.log(`[SendGrid] Response status: ${response.status} ${response.statusText}`);
  console.log(`[SendGrid] Response body: ${responseText.substring(0, 500)}`);
  
  if (!response.ok) {
    console.error('[SendGrid] API error:', response.status, responseText);
    throw new Error(`Failed to send email: ${response.status} - ${responseText}`);
  }

  // Log successful send
  if (response.status === 202) {
    console.log(`[SendGrid] Email accepted for delivery to ${to}`);
  }

  return { success: true, provider: 'SendGrid' };
}

/**
 * Send email using SMTP (via external service or direct SMTP)
 * For Deno, we can use fetch to call an SMTP relay service
 * Or implement direct SMTP connection using Deno's TCP capabilities
 */
async function sendEmailViaSMTP(to, subject, html, text) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('SMTP configuration is incomplete');
  }

  // For Deno, we can use a simple HTTP-to-SMTP relay service
  // Or implement SMTP directly using Deno's native TCP
  // For now, we'll provide a basic implementation that works with most SMTP servers
  
  // Option 1: Use mailgun or similar service that provides HTTP API
  // Option 2: Implement native SMTP (more complex)
  
  // For simplicity, let's use a fetch-based approach for SMTP relay
  // You can configure this to use services like Mailgun, Postmark, etc.
  
  // Basic SMTP send using fetch (requires SMTP relay service with HTTP API)
  // For direct SMTP, we'd need to implement SMTP protocol using Deno TCP
  
  throw new Error('Direct SMTP not yet implemented. Please use SendGrid or configure an SMTP relay service.');
}

/**
 * Main function to send email
 * Automatically chooses the best available method
 */
async function sendEmailMain(to, subject, html, text) {
  try {
    if (USE_SENDGRID) {
      console.log(`[Email] Sending via SendGrid to: ${to}`);
      return await sendEmailViaSendGrid(to, subject, html, text);
    } else if (USE_SMTP) {
      console.log(`[Email] Sending via SMTP to: ${to}`);
      return await sendEmailViaSMTP(to, subject, html, text);
    } else {
      // Development fallback: just log
      console.log(`[Email] No email service configured. Would send to ${to}:`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${html}`);
      return { success: true, provider: 'console (dev mode)' };
    }
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    throw error;
  }
}

/**
 * Send verification code email
 */
export async function sendVerificationCodeEmail(email, code) {
  const subject = 'HandyGO - Verification Code';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ECF86E; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: #fff; border: 2px solid #ECF86E; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #000; letter-spacing: 8px; font-family: monospace; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; color: #000;">HandyGO</h1>
        </div>
        <div class="content">
          <h2>Your Verification Code</h2>
          <p>Hello!</p>
          <p>You requested a verification code for your HandyGO account. Please use the following code to complete your registration:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p>This code will expire in <strong>5 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div class="footer">
            <p>© 2025 HandyGO - Aalto University</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
HandyGO - Verification Code

Hello!

You requested a verification code for your HandyGO account. Please use the following code to complete your registration:

${code}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

© 2025 HandyGO - Aalto University
This is an automated message, please do not reply.
  `;

  return await sendEmailMain(email, subject, html, text.trim());
}

