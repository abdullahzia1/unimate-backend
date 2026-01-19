import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Queue from 'bull';
import { EmailService } from './email.service';

interface EmailJob {
  type:
    | 'otp'
    | 'password-reset'
    | 'waitlist-welcome'
    | 'waitlist-already-exists';
  to: string;
  data: {
    otp?: string;
    resetToken?: string;
    name: string;
    platform?: string;
  };
}

@Injectable()
export class EmailQueueService implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueService.name);
  private emailQueue: Queue.Queue<EmailJob>;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    // Initialize Bull queue with Redis
    this.emailQueue = new Queue('email-queue', {
      redis: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Initialize custom SMTP (AWS SES)
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('AWS SES SMTP initialized successfully');
    } else {
      this.logger.warn('SMTP not configured, will use Postmark fallback only');
    }
  }

  onModuleInit() {
    // Process queue when module initializes
    this.processQueue();
    this.logger.log('Email queue processor started');
  }

  /**
   * Add OTP email to queue
   */
  async queueOtpEmail(email: string, otp: string, name: string): Promise<void> {
    await this.emailQueue.add(
      {
        type: 'otp',
        to: email,
        data: { otp, name },
      },
      {
        priority: 1, // High priority for OTP
      },
    );
    this.logger.log(`OTP email queued for ${email}`);
  }

  /**
   * Add password reset email to queue
   */
  async queuePasswordResetEmail(
    email: string,
    resetToken: string,
    name: string,
  ): Promise<void> {
    await this.emailQueue.add(
      {
        type: 'password-reset',
        to: email,
        data: { resetToken, name },
      },
      {
        priority: 1, // High priority
      },
    );
    this.logger.log(`Password reset email queued for ${email}`);
  }

  /**
   * Add waitlist welcome email to queue
   */
  async queueWaitlistWelcomeEmail(
    email: string,
    name: string,
    platform?: string,
  ): Promise<void> {
    // Add timeout to prevent hanging if Redis is unavailable
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Email queue timeout')), 5000); // 5 second timeout
    });

    await Promise.race([
      this.emailQueue.add(
        {
          type: 'waitlist-welcome',
          to: email,
          data: { name, platform },
        },
        {
          priority: 2, // Normal priority
        },
      ),
      timeoutPromise,
    ]).catch((error) => {
      this.logger.warn(
        `Failed to queue waitlist welcome email for ${email}:`,
        error,
      );
      throw error;
    });

    this.logger.log(`Waitlist welcome email queued for ${email}`);
  }

  /**
   * Add waitlist already exists email to queue
   */
  async queueWaitlistAlreadyExistsEmail(
    email: string,
    name: string,
  ): Promise<void> {
    // Add timeout to prevent hanging if Redis is unavailable
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Email queue timeout')), 5000); // 5 second timeout
    });

    await Promise.race([
      this.emailQueue.add(
        {
          type: 'waitlist-already-exists',
          to: email,
          data: { name },
        },
        {
          priority: 2, // Normal priority
        },
      ),
      timeoutPromise,
    ]).catch((error) => {
      this.logger.warn(
        `Failed to queue already exists email for ${email}:`,
        error,
      );
      throw error;
    });

    this.logger.log(`Waitlist already exists email queued for ${email}`);
  }

  /**
   * Process email queue
   */
  private processQueue(): void {
    void this.emailQueue.process(async (job) => {
      const { type, to, data } = job.data;
      this.logger.log(`Processing ${type} email for ${to}`);

      try {
        // Try custom SMTP first (AWS SES)
        if (this.smtpTransporter) {
          await this.sendViaCustomSMTP(type, to, data);
          this.logger.log(`Email sent via AWS SES to ${to}`);
          return;
        }
      } catch (error) {
        this.logger.warn(
          `AWS SES failed for ${to}, falling back to Postmark...`,
          error instanceof Error ? error.message : String(error),
        );
      }

      // Fallback to Postmark
      try {
        if (type === 'otp') {
          await this.emailService.sendOtpEmail(to, data.otp!, data.name);
        } else if (type === 'password-reset') {
          await this.emailService.sendPasswordResetEmail(
            to,
            data.resetToken!,
            data.name,
          );
        } else {
          // Waitlist emails - use custom SMTP only for now
          // Could add Postmark support later if needed
          throw new Error(`Postmark fallback not implemented for ${type}`);
        }
        this.logger.log(`Email sent via Postmark fallback to ${to}`);
      } catch (error) {
        this.logger.error(`All email methods failed for ${to}:`, error);
        throw error; // Will trigger retry
      }
    });

    // Handle queue events
    this.emailQueue.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed for ${job.data.to}`);
    });

    this.emailQueue.on('failed', (job, err) => {
      this.logger.error(
        `Job ${job.id} failed for ${job.data.to} after ${job.attemptsMade} attempts:`,
        err instanceof Error ? err.message : String(err),
      );
    });

    this.emailQueue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled for ${job.data.to}`);
    });
  }

  /**
   * Send email via custom SMTP (AWS SES)
   */
  private async sendViaCustomSMTP(
    type:
      | 'otp'
      | 'password-reset'
      | 'waitlist-welcome'
      | 'waitlist-already-exists',
    to: string,
    data: {
      otp?: string;
      resetToken?: string;
      name: string;
      platform?: string;
    },
  ): Promise<void> {
    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter not initialized');
    }

    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL');
    const fromName = this.configService.get<string>(
      'SMTP_FROM_NAME',
      'OneOrb Shield',
    );

    let subject: string;
    let textBody: string;
    let htmlBody: string;

    if (type === 'otp') {
      subject = 'Verify Your Email - OneOrb Shield';
      textBody = `Hi ${data.name},\n\nYour verification code is: ${data.otp!}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nOneOrb Shield Team`;
      htmlBody = this.buildOtpHtml(data.name, data.otp!);
    } else if (type === 'password-reset') {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const resetLink = `${frontendUrl}/reset-password?token=${data.resetToken!}`;
      subject = 'Reset Your Password - OneOrb Shield';
      textBody = `Hi ${data.name},\n\nReset your password: ${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nOneOrb Shield Team`;
      htmlBody = this.buildPasswordResetHtml(data.name, resetLink);
    } else if (type === 'waitlist-welcome') {
      subject = 'Welcome to the Waitlist - OneOrb Shield';
      textBody = `Hi ${data.name},\n\nThank you for joining the waitlist for OneOrb Shield ${data.platform || 'Windows'} version!\n\nWe'll notify you as soon as the ${data.platform || 'Windows'} version is available for download.\n\nBest regards,\nOneOrb Shield Team`;
      htmlBody = this.buildWaitlistWelcomeHtml(
        data.name,
        data.platform || 'Windows',
      );
    } else if (type === 'waitlist-already-exists') {
      subject = "You're Already on the Waitlist - OneOrb Shield";
      textBody = `Hi ${data.name},\n\nYou're already on our waitlist! We'll notify you as soon as the Windows version is available.\n\nThank you for your interest!\n\nBest regards,\nOneOrb Shield Team`;
      htmlBody = this.buildWaitlistAlreadyExistsHtml(data.name);
    } else {
      throw new Error(`Unknown email type: ${type as string}`);
    }

    await this.smtpTransporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody,
    });
  }

  private buildOtpHtml(name: string, otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ OneOrb Shield</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for signing up! Please use the verification code below to complete your registration:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
            <p>Best regards,<br>The OneOrb Shield Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OneOrb Shield. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private buildPasswordResetHtml(name: string, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .button:hover { background: #0ea571; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ OneOrb Shield</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetLink}</p>
            <div class="warning">
              <p style="margin: 0;"><strong>⚠️ This link will expire in 1 hour.</strong></p>
            </div>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>Best regards,<br>The OneOrb Shield Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OneOrb Shield. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private buildWaitlistWelcomeHtml(name: string, platform: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .button:hover { background: #0ea571; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .info-box { background: #e0f2fe; border-left: 4px solid #06b6d4; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ OneOrb Shield</h1>
            <p>Welcome to the Waitlist!</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for joining the waitlist for <strong>OneOrb Shield ${platform}</strong> version!</p>
            <div class="info-box">
              <p style="margin: 0;"><strong>📧 What's Next?</strong></p>
              <p style="margin: 10px 0 0 0;">We'll notify you via email as soon as the ${platform} version is available for download. Stay tuned!</p>
            </div>
            <p>In the meantime, you can check out our website to learn more about OneOrb Shield and its features.</p>
            <p>Best regards,<br>The OneOrb Shield Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OneOrb Shield. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private buildWaitlistAlreadyExistsHtml(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ OneOrb Shield</h1>
            <p>You're Already on the Waitlist!</p>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>You're already on our waitlist! We'll notify you as soon as the Windows version is available for download.</p>
            <div class="info-box">
              <p style="margin: 0;"><strong>✅ You're All Set!</strong></p>
              <p style="margin: 10px 0 0 0;">No need to sign up again. We have your email and will notify you when the Windows version is ready.</p>
            </div>
            <p>Thank you for your interest in OneOrb Shield!</p>
            <p>Best regards,<br>The OneOrb Shield Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} OneOrb Shield. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
