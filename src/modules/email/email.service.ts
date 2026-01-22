import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private postmarkClient: postmark.ServerClient | null = null;

  constructor(private configService: ConfigService) {
    // Initialize Postmark
    const postmarkConfig = this.configService.get<{
      apiKey?: string;
    }>('postmark');
    if (postmarkConfig?.apiKey) {
      this.postmarkClient = new postmark.ServerClient(postmarkConfig.apiKey);
      this.logger.log('Postmark initialized successfully as fallback');
    } else {
      this.logger.warn(
        'Postmark API key not configured - no fallback email service available',
      );
    }
  }

  async sendOtpEmail(email: string, otp: string, name: string): Promise<void> {
    const postmarkConfig = this.configService.get<{
      fromName: string;
      fromEmail?: string;
    }>('postmark');
    const fromName = postmarkConfig?.fromName || 'Unimate';

    const subject = 'Verify Your Email - Unimate';
    const textBody = `Hi ${name},\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nUnimate Team`;
    const htmlBody = `
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
                <h1>🛡️ Unimate</h1>
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
                
                <p>Best regards,<br>The Unimate Team</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Unimate. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
          `;

    if (this.postmarkClient) {
      try {
        const postmarkConfig = this.configService.get<{
          fromEmail?: string;
        }>('postmark');
        const postmarkFromEmail =
          postmarkConfig?.fromEmail || 'noreply@unimate.com';

        const result = await this.postmarkClient.sendEmail({
          From: `${fromName} <${postmarkFromEmail}>`,
          To: email,
          Subject: subject,
          TextBody: textBody,
          HtmlBody: htmlBody,
          MessageStream: 'outbound',
        });

        this.logger.log(
          `OTP email sent successfully to ${email} via Postmark. MessageID: ${result.MessageID}`,
        );
        return;
      } catch (error) {
        this.logger.error(
          `Postmark failed to send OTP email to ${email}:`,
          error,
        );
        throw new Error('Failed to send verification email');
      }
    }

    // No service available
    this.logger.error('Postmark is not configured');
    throw new Error('Email service is not properly configured');
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name: string,
  ): Promise<void> {
    const postmarkConfig = this.configService.get<{
      fromName: string;
      fromEmail?: string;
    }>('postmark');
    const securityConfig = this.configService.get<{
      frontendUrl: string;
    }>('security');
    const fromName = postmarkConfig?.fromName || 'Unimate';
    const frontendUrl = securityConfig?.frontendUrl || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const subject = 'Reset Your Password - Unimate';
    const textBody = `Hi ${name || 'there'},\n\nWe received a request to reset your password. Click the link below to reset it:\n\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nUnimate Team`;
    const htmlBody = `
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
              <h1>🛡️ Unimate</h1>
              <p>Password Reset Request</p>
            </div>
            <div class="content">
              <p>Hi ${name || 'there'},</p>
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
              
              <p>Best regards,<br>The Unimate Team</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Unimate. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
  `;
    if (this.postmarkClient) {
      try {
        const postmarkConfig = this.configService.get<{
          fromEmail?: string;
        }>('postmark');
        const postmarkFromEmail =
          postmarkConfig?.fromEmail || 'noreply@unimate.com';

        const result = await this.postmarkClient.sendEmail({
          From: `${fromName} <${postmarkFromEmail}>`,
          To: email,
          Subject: subject,
          TextBody: textBody,
          HtmlBody: htmlBody,
          MessageStream: 'outbound',
        });

        this.logger.log(
          `Password reset email sent successfully to ${email} via Postmark. MessageID: ${result.MessageID}`,
        );
        return;
      } catch (error) {
        this.logger.error(
          `Postmark failed to send password reset email to ${email}:`,
          error,
        );
        throw new Error('Failed to send password reset email');
      }
    }

    // No service available
    this.logger.error('Postmark is not configured');
    throw new Error('Email service is not properly configured');
  }
}
