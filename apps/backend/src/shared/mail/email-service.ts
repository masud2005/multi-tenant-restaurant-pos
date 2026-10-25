import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isPlaceholder?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): { transporter: nodemailer.Transporter | null; from: string; isPlaceholder: boolean } {
    const clean = (val: string | undefined | null) => (val ? String(val).replace(/^["']|["']$/g, '').trim() : '');
    const host = clean(this.configService.get<string>('mail.host') || process.env.SMTP_HOST);
    const port = Number(this.configService.get<number>('mail.port') || process.env.SMTP_PORT) || 587;
    const secure = String(this.configService.get<string>('mail.secure') || process.env.SMTP_SECURE) === 'true';
    const user = clean(this.configService.get<string>('mail.user') || process.env.SMTP_USER);
    const pass = clean(this.configService.get<string>('mail.pass') || process.env.SMTP_PASS);
    const from =
      clean(this.configService.get<string>('mail.from') || process.env.SMTP_FROM) ||
      `"Tablewise POS" <${user || 'noreply@tablewise.pos'}>`;

    const isPlaceholder =
      !host ||
      host.includes('example.com') ||
      user.includes('example.com') ||
      pass === 'your_smtp_password' ||
      !pass;

    if (isPlaceholder) {
      return { transporter: null, from, isPlaceholder: true };
    }

    // Support Gmail service configuration directly
    if (host.includes('gmail') || user.endsWith('@gmail.com')) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      return { transporter, from, isPlaceholder: false };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure || port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    return { transporter, from, isPlaceholder: false };
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<SendEmailResult> {
    const { transporter, from, isPlaceholder } = this.getTransporter();

    if (isPlaceholder || !transporter) {
      const warning =
        `[EmailService] Real email sending skipped: SMTP configuration in .env has placeholder values (smtp.example.com). ` +
        `To send real emails to ${to}, configure valid SMTP credentials in apps/backend/.env (e.g. Gmail App Password or Mailtrap).`;
      this.logger.warn(warning);
      return { success: false, isPlaceholder: true, error: 'SMTP credentials in .env are placeholder' };
    }

    try {
      const mailOptions = {
        from,
        to,
        subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`[EmailService] Email successfully sent to ${to}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId, isPlaceholder: false };
    } catch (error: any) {
      this.logger.error(`[EmailService] Error sending email to ${to}: ${error.message || error}`, error.stack);
      return { success: false, error: error.message || 'Failed to send email', isPlaceholder: false };
    }
  }
}