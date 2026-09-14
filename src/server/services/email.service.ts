import nodemailer from 'nodemailer';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  recipientName?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  private static getTransporter(): any {
    if (this.transporter) return this.transporter;

    const host = (config.smtpHost || process.env.SMTP_HOST || '').trim();
    const user = (config.smtpUser || process.env.SMTP_USER || '').trim();
    const pass = (config.smtpPass || process.env.SMTP_PASS || '').trim();

    if (!host || host === 'your_smtp_host_here' || host === 'smtp.example.com') {
      return null;
    }
    // Filter out placeholder user/pass credentials to avoid doomed connection attempts
    if (!user || user === 'your_brevo_login_email_here' || user === 'your_smtp_user_here') {
      return null;
    }
    if (!pass || pass === 'your_brevo_smtp_key_here' || pass === 'your_smtp_pass_here') {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: config.smtpPort || Number(process.env.SMTP_PORT) || 587,
      secure: config.smtpPort === 465,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  /**
   * Dispatches email via Brevo REST API v3 or SMTP Relay with circuit breaker and retry resilience.
   */
  public static async send(options: SendEmailOptions): Promise<void> {
    const brevoApiKey = (config.brevoApiKey || process.env.BREVO_API_KEY || '').trim();
    const rawSenderEmail =
      config.brevoSenderEmail ||
      process.env.BREVO_SENDER_EMAIL ||
      config.emailFrom ||
      process.env.EMAIL_FROM ||
      'noreply@stockora.com';
    const rawSenderName =
      config.brevoSenderName || process.env.BREVO_SENDER_NAME || 'Stockora Enterprise';
    const senderEmail = rawSenderEmail.replace(/^["']|["']$/g, '').trim();
    const senderName = rawSenderName.replace(/^["']|["']$/g, '').trim();

    logger.info(`[EMAIL] Preparing email delivery for recipient [${options.to}]`);

    await ResilientExecutor.execute(
      {
        name: 'EmailService_Delivery',
        retryCount: 3,
        timeoutMs: 8000,
        backoffType: 'EXPONENTIAL',
        jitterType: 'DECORRELATED',
        bulkheadMaxConcurrency: 5,
        isIdempotent: true,
      },
      async () => {
        // 1. Direct Brevo Transactional API (Primary if valid API key configured)
        if (brevoApiKey && brevoApiKey !== 'your_brevo_api_key_here') {
          try {
            logger.info('[EMAIL] Provider request started: Brevo Transactional API v3');
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
              method: 'POST',
              headers: {
                accept: 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [
                  {
                    email: options.to.trim().toLowerCase(),
                    name: options.recipientName || options.to.split('@')[0],
                  },
                ],
                subject: options.subject,
                htmlContent: options.html || options.text,
                textContent: options.text,
              }),
            });

            if (response.ok) {
              logger.info(
                `[EMAIL] Provider response received: Delivery accepted by Brevo for [${options.to}].`
              );
              return;
            }

            const errorText = await response.text();
            logger.error(`[EMAIL] Provider response error (${response.status}): ${errorText}`);

            // If SMTP is available with real credentials, attempt fallback
            const smtp = this.getTransporter();
            if (smtp) {
              logger.info('[EMAIL] Attempting SMTP Relay fallback following Brevo API error...');
              await smtp.sendMail({
                from: `"${senderName}" <${senderEmail}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
              });
              logger.info(
                `[EMAIL] Provider response received: Delivery accepted via SMTP Relay fallback for [${options.to}].`
              );
              return;
            }

            throw new Error(`Email provider error (${response.status}): ${errorText}`);
          } catch (brevoErr: any) {
            logger.error('[EMAIL] Brevo delivery attempt failed:', brevoErr?.message || brevoErr);
            throw brevoErr;
          }
        }

        // 2. SMTP Transport (Brevo SMTP relay or custom provider)
        const smtp = this.getTransporter();
        if (smtp) {
          logger.info('[EMAIL] Provider request started: SMTP Relay');
          await smtp.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
          });
          logger.info(
            `[EMAIL] Provider response received: Delivery accepted via SMTP Relay for [${options.to}].`
          );
          return;
        }

        // 3. Fallback warning if no credentials configured
        logger.warn(
          `[EMAIL] Neither valid BREVO_API_KEY nor active SMTP_HOST configured. Unable to deliver email to [${options.to}].`
        );
        throw new Error('Email delivery service is currently not configured.');
      }
    );
  }

  // --- HTML Email Templates ---

  private static wrapTemplate(title: string, bodyContent: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; }
    .container { max-width: 540px; margin: 40px auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1e293b; }
    .logo-text { font-size: 24px; font-weight: 800; background: linear-gradient(90deg, #a78bfa, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 0.05em; }
    .content { padding: 32px; }
    .otp-box { background: #1e293b; border: 2px dashed #8b5cf6; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
    .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #a78bfa; font-family: 'Courier New', Courier, monospace; }
    .footer { padding: 24px 32px; background: #090d16; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
    .warning { color: #f59e0b; font-size: 13px; line-height: 1.5; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">STOCKORA ENTERPRISE</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Stockora Enterprise Inc. All rights reserved.</p>
      <p>This is an automated system notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Sends 6-digit Email Verification OTP
   */
  public static async sendVerificationOtp(
    email: string,
    username: string,
    otp: string,
    expiryMinutes = 10
  ): Promise<void> {
    const subject = `${otp} is your Stockora verification code`;
    const text = `Hello ${username},\n\nYour Stockora email verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes. If you did not create an account, please disregard this email.`;

    const html = this.wrapTemplate(
      'Verify Your Stockora Account',
      `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 22px;">Verify your email address</h2>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${username}</strong>,</p>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">Thank you for registering with Stockora Enterprise. Use the verification code below to verify your email and activate your workspace access.</p>
      
      <div class="otp-box">
        <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 8px;">Verification Code</div>
        <div class="otp-code">${otp}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Expires in ${expiryMinutes} minutes</div>
      </div>

      <p class="warning">&#9888; Never share this code with anyone. Stockora representatives will never ask for your verification code.</p>
      `
    );

    await this.send({ to: email, subject, text, html, recipientName: username });
  }

  /**
   * Sends 6-digit Password Reset OTP
   */
  public static async sendPasswordResetOtp(
    email: string,
    username: string,
    otp: string,
    expiryMinutes = 10
  ): Promise<void> {
    const subject = `${otp} is your Stockora password reset code`;
    const text = `Hello ${username},\n\nWe received a request to reset your password. Your password reset verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes. If you did not request a password reset, please secure your account immediately.`;

    const html = this.wrapTemplate(
      'Reset Your Stockora Password',
      `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 22px;">Password Reset Request</h2>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${username}</strong>,</p>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your Stockora Enterprise account. Use the code below to authorize your password change.</p>
      
      <div class="otp-box">
        <div style="font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 8px;">Password Reset Code</div>
        <div class="otp-code">${otp}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Expires in ${expiryMinutes} minutes</div>
      </div>

      <p class="warning">&#9888; If you did not request this password reset, please ignore this email or contact your platform administrator immediately.</p>
      `
    );

    await this.send({ to: email, subject, text, html, recipientName: username });
  }

  /**
   * Sends Workspace Employee Invitation Link (Clickable Action)
   */
  public static async sendEmployeeInvitationLink(
    email: string,
    inviterName: string,
    companyName: string,
    roleName: string,
    inviteUrl: string,
    expiryHours = 72
  ): Promise<void> {
    const expiryDays = Math.round(expiryHours / 24);
    const expiryText =
      expiryDays >= 1 ? `${expiryDays} day${expiryDays > 1 ? 's' : ''}` : `${expiryHours} hours`;
    const subject = `You're invited to join ${companyName} on Stockora Enterprise`;
    const text = `Hello,\n\n${inviterName} has invited you to join ${companyName} as a ${roleName} on Stockora Enterprise.\n\nTo accept your invitation and begin your employee account setup, click the link below:\n${inviteUrl}\n\nThis invitation link expires in ${expiryText}.\n\nIf you did not expect this invitation, you can safely ignore this email.`;

    const html = this.wrapTemplate(
      `Join ${companyName} on Stockora Enterprise`,
      `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 22px;">Workspace Team Invitation</h2>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello,</p>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;"><strong>${inviterName}</strong> has invited you to join the <strong>${companyName}</strong> workspace on Stockora Enterprise as a <strong>${roleName}</strong>.</p>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">Click the button below to accept your invitation and begin your account setup.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); letter-spacing: 0.5px;">ACCEPT INVITATION</a>
      </div>

      <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 16px; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">Or copy and paste this link into your browser:<br /><a href="${inviteUrl}" style="color: #818cf8; word-break: break-all; font-size: 12px;">${inviteUrl}</a></p>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This invitation expires in ${expiryText}. If you did not expect this invitation, you can safely ignore this email.</p>
      `
    );

    await this.send({ to: email, subject, text, html });
  }

  /**
   * Sends Welcome Email after verification
   */
  public static async sendWelcome(email: string, username: string): Promise<void> {
    const subject = 'Welcome to Stockora Enterprise';
    const text = `Hello ${username},\n\nWelcome to Stockora Enterprise! Your account has been verified and is ready for use.`;

    const html = this.wrapTemplate(
      'Welcome to Stockora Enterprise',
      `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 22px;">Welcome to Stockora Enterprise</h2>
      <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${username}</strong>,</p>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">Your workspace account has been verified successfully. You now have full access to your assigned branch terminals, inventory intelligence, and business management consoles.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${config.corsOrigin}" style="background: linear-gradient(90deg, #8b5cf6, #3b82f6); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">Launch Workspace Dashboard</a>
      </div>
      `
    );

    await this.send({ to: email, subject, text, html, recipientName: username });
  }

  /**
   * Sends Multi-Tenant Customer Invoice / E-Receipt with authoritative seller identity
   */
  public static async sendCustomerInvoiceReceipt(options: {
    to: string;
    customerName: string;
    companyName: string;
    companyLegalName?: string;
    companyLogoUrl?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyTaxId?: string;
    receiptHeader?: string;
    receiptFooter?: string;
    invoiceNumber: string;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    totalAmount: number;
    currency: string;
    paymentMethod: string;
    date: Date | string;
  }): Promise<void> {
    const {
      to,
      customerName,
      companyName,
      companyLegalName,
      companyLogoUrl,
      companyAddress,
      companyPhone,
      companyEmail,
      companyTaxId,
      receiptHeader,
      receiptFooter,
      invoiceNumber,
      items,
      subtotal,
      taxTotal,
      discountTotal,
      totalAmount,
      currency,
      paymentMethod,
      date,
    } = options;

    const formattedDate = new Date(date).toLocaleString();
    const subject = `Your Receipt from ${companyName} - #${invoiceNumber}`;

    const itemsRows = items
      .map(
        (it) => `
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px;">${it.name} <span style="color: #94a3b8; font-size: 12px;">x${it.quantity}</span></td>
          <td style="padding: 10px 0; color: #f1f5f9; font-size: 14px; text-align: right;">${currency} ${it.total.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt from ${companyName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; }
    .container { max-width: 540px; margin: 40px auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #1e293b; background: #1e293b; }
    .company-logo { max-height: 50px; margin-bottom: 12px; }
    .company-name { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 4px; letter-spacing: -0.02em; }
    .company-meta { font-size: 12px; color: #94a3b8; line-height: 1.4; }
    .content { padding: 24px 32px; }
    .receipt-info { display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8; margin-bottom: 20px; border-bottom: 1px dashed #334155; padding-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .totals { border-top: 2px solid #334155; padding-top: 12px; font-size: 14px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; color: #cbd5e1; }
    .grand-total { font-size: 18px; font-weight: 800; color: #38bdf8; border-top: 1px solid #334155; padding-top: 8px; margin-top: 4px; }
    .footer { padding: 20px 32px; background: #090d16; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; }
    .powered-badge { display: inline-block; margin-top: 12px; padding: 4px 12px; background: #1e293b; border-radius: 20px; color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName}" class="company-logo" />` : ''}
      <h1 class="company-name">${companyName}</h1>
      ${companyLegalName && companyLegalName !== companyName ? `<div class="company-meta">${companyLegalName}</div>` : ''}
      ${companyAddress ? `<div class="company-meta">${companyAddress}</div>` : ''}
      ${companyPhone || companyEmail ? `<div class="company-meta">${[companyPhone, companyEmail].filter(Boolean).join(' &bull; ')}</div>` : ''}
      ${companyTaxId ? `<div class="company-meta">Tax ID / VAT: ${companyTaxId}</div>` : ''}
      ${receiptHeader ? `<div style="margin-top: 8px; font-size: 12px; color: #cbd5e1; font-style: italic;">${receiptHeader}</div>` : ''}
    </div>

    <div class="content">
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: #94a3b8;">Receipt #: <strong style="color: #f1f5f9;">${invoiceNumber}</strong></div>
        <div style="font-size: 13px; color: #94a3b8;">Date: <strong style="color: #f1f5f9;">${formattedDate}</strong></div>
        <div style="font-size: 13px; color: #94a3b8;">Customer: <strong style="color: #f1f5f9;">${customerName}</strong></div>
        <div style="font-size: 13px; color: #94a3b8;">Payment: <strong style="color: #f1f5f9;">${paymentMethod}</strong></div>
      </div>

      <table class="table">
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>${currency} ${subtotal.toFixed(2)}</span>
        </div>
        ${discountTotal > 0 ? `<div class="total-row" style="color: #4ade80;"><span>Discount</span><span>-${currency} ${discountTotal.toFixed(2)}</span></div>` : ''}
        ${taxTotal > 0 ? `<div class="total-row"><span>Tax / VAT</span><span>${currency} ${taxTotal.toFixed(2)}</span></div>` : ''}
        <div class="total-row grand-total">
          <span>Total Paid</span>
          <span>${currency} ${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      ${receiptFooter ? `<div style="margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px dashed #334155; padding-top: 16px;">${receiptFooter}</div>` : ''}
    </div>

    <div class="footer">
      <div>Thank you for your business with ${companyName}!</div>
      <div><span class="powered-badge">Powered by Stockora Enterprise Mini</span></div>
    </div>
  </div>
</body>
</html>
`;

    const text =
      `RECEIPT FROM ${companyName}\nReceipt #: ${invoiceNumber}\nDate: ${formattedDate}\nCustomer: ${customerName}\n\n` +
      items.map((i) => `${i.name} x${i.quantity} = ${currency} ${i.total.toFixed(2)}`).join('\n') +
      `\n\nSubtotal: ${currency} ${subtotal.toFixed(2)}\nTotal: ${currency} ${totalAmount.toFixed(2)}\n\nThank you for choosing ${companyName}.\nPowered by Stockora Enterprise Mini`;

    await this.send({
      to,
      subject,
      text,
      html,
      recipientName: customerName,
    });
  }
}
