import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { OtpVerification } from '../../database/entities/otp-verification.entity';
import { PasswordReset } from '../../database/entities/password-reset.entity';
import { OAuthProvider, User } from '../../database/entities/user.entity';
import { EmailQueueService } from '../email/email-queue.service';
import { EmailService } from '../email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthResponse, JwtPayload } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OtpVerification)
    private otpRepository: Repository<OtpVerification>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private emailQueueService: EmailQueueService,
  ) {}

  /**
   * Register a new user with email/password
   */
  /**
   * Register a new user - sends OTP instead of creating user immediately
   */
  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException({
        message: 'User already exists. Please login instead.',
        code: 'USER_ALREADY_EXISTS',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash password and OTP
    const passwordHash = await this.hashPassword(password);
    const otpHash = await this.hashPassword(otp);

    // Calculate expiry time (10 minutes from now)
    const expiresAt = new Date();
    const authConfig = this.configService.get<{
      otpExpiryMinutes: number;
    }>('auth');
    const expiryMinutes = authConfig?.otpExpiryMinutes || 10;
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Delete any existing OTP for this email
    await this.otpRepository.delete({ email });

    // Store OTP verification record
    const otpVerification = this.otpRepository.create({
      email,
      otpHash,
      name: name || email.split('@')[0],
      passwordHash,
      expiresAt,
      attempts: 0,
    });

    await this.otpRepository.save(otpVerification);

    // Send OTP email (queued in background)
    try {
      await this.emailQueueService.queueOtpEmail(
        email,
        otp,
        name || email.split('@')[0],
      );
    } catch {
      // Clean up OTP record if email queue fails
      await this.otpRepository.delete({ email });
      throw new BadRequestException(
        'Failed to queue verification email. Please try again.',
      );
    }

    this.logger.log(`OTP queued for ${email}`);

    return {
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Verify OTP and create user account
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    const { email, otp } = verifyOtpDto;

    // Find OTP record
    const otpRecord = await this.otpRepository.findOne({ where: { email } });

    if (!otpRecord) {
      throw new BadRequestException(
        'No verification code found for this email. Please request a new code.',
      );
    }

    // Check if expired
    if (new Date() > otpRecord.expiresAt) {
      await this.otpRepository.delete({ email });
      throw new BadRequestException(
        'Verification code has expired. Please request a new code.',
      );
    }

    // Check attempts limit (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await this.otpRepository.delete({ email });
      throw new BadRequestException(
        'Too many failed attempts. Please request a new code.',
      );
    }

    // Verify OTP
    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isOtpValid) {
      // Increment attempts
      otpRecord.attempts += 1;
      await this.otpRepository.save(otpRecord);

      throw new BadRequestException(
        `Invalid verification code. ${5 - otpRecord.attempts} attempts remaining.`,
      );
    }

    // Check if user was created in the meantime
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      // Clean up OTP and return existing user
      await this.otpRepository.delete({ email });
      return this.generateAuthResponse(existingUser);
    }

    // Create new user
    const user = this.userRepository.create({
      email,
      password: otpRecord.passwordHash, // Already hashed
      name: otpRecord.name,
      avatar: this.generateRandomAvatar(otpRecord.name || email),
      provider: OAuthProvider.LOCAL,
    });

    const savedUser = await this.userRepository.save(user);

    // Delete OTP record
    await this.otpRepository.delete({ email });

    this.logger.log(`User created and verified: ${email}`);

    return this.generateAuthResponse(savedUser);
  }

  /**
   * Resend OTP
   */
  async resendOtp(resendOtpDto: ResendOtpDto): Promise<{ message: string }> {
    const { email } = resendOtpDto;

    // Find existing OTP record
    const otpRecord = await this.otpRepository.findOne({ where: { email } });

    if (!otpRecord) {
      throw new BadRequestException(
        'No pending verification found for this email.',
      );
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await this.hashPassword(otp);

    // Update expiry time
    const expiresAt = new Date();
    const authConfig = this.configService.get<{
      otpExpiryMinutes: number;
    }>('auth');
    const expiryMinutes = authConfig?.otpExpiryMinutes || 10;
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Update OTP record
    otpRecord.otpHash = otpHash;
    otpRecord.expiresAt = expiresAt;
    otpRecord.attempts = 0; // Reset attempts

    await this.otpRepository.save(otpRecord);

    // Send new OTP email (queued in background)
    try {
      await this.emailQueueService.queueOtpEmail(email, otp, otpRecord.name);
    } catch {
      throw new BadRequestException(
        'Failed to queue verification email. Please try again.',
      );
    }

    this.logger.log(`OTP queued for resend to ${email}`);

    return {
      message: 'New verification code sent to your email',
    };
  }

  /**
   * Login with email/password
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });

    // Log login attempt - using multiple methods to ensure visibility
    console.log(
      `[AUTH DEBUG] Login attempt - Email: ${email}, User exists: ${!!user}, Has password: ${!!user?.password}`,
    );
    this.logger.log(
      `[AuthService] Login attempt - Email: ${email}, User exists: ${!!user}, Has password: ${!!user?.password}`,
    );
    this.logger.error(
      `[AuthService ERROR LEVEL] Login attempt - Email: ${email}, User exists: ${!!user}, Has password: ${!!user?.password}`,
    );

    if (!user) {
      this.logger.error(
        `[AuthService] Login failed - User not found for email: ${email}`,
      );
      throw new NotFoundException(
        'No account found. Please create an account.',
      );
    }

    // Check if user has a password (local auth users should have password)
    if (!user.password) {
      this.logger.error(
        `[AuthService] Login failed - No password set for email: ${email}`,
      );
      throw new NotFoundException(
        'No account found. Please create an account.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.error(
        `[AuthService] Login failed - Invalid password for email: ${email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`[AuthService] Login successful for email: ${email}`);

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return await this.generateAuthResponse(user);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Find user by ID from token
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND',
        });
      }

      // Validate stored refresh token matches
      if (!user.refreshToken || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException({
          message: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      // Check if refresh token is expired
      if (user.refreshTokenExpireAt && user.refreshTokenExpireAt < new Date()) {
        throw new UnauthorizedException({
          message: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED',
        });
      }

      this.logger.log(`[AuthService] Token refreshed for user: ${user.email}`);

      // Generate new tokens
      return await this.generateAuthResponse(user);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Check if JWT verification failed due to expiration
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        typeof (error as { name?: unknown }).name === 'string' &&
        (error as { name: string }).name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException({
          message: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED',
        });
      }

      const errorMessage =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Unknown error';

      this.logger.error(`[AuthService] Token refresh failed: ${errorMessage}`);
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const securityConfig = this.configService.get<{
      bcryptRounds: number;
    }>('security');
    const rounds = securityConfig?.bcryptRounds || 10;
    return await bcrypt.hash(password, rounds);
  }

  /**
   * Generate a random avatar URL for local signups
   */
  private generateRandomAvatar(seedSource?: string): string {
    const seed = `${seedSource?.trim() || 'user'}-${crypto.randomBytes(6).toString('hex')}`;
    return `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
  }

  /**
   * Generate JWT token and auth response
   */
  private async generateAuthResponse(user: User): Promise<AuthResponse> {
    if (!user.avatar) {
      user.avatar = this.generateRandomAvatar(user.name || user.email);
      await this.userRepository.update(user.id, { avatar: user.avatar });
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      accessLevel: user.accessLevel,
      departmentId: user.departmentId,
      departmentIds: user.departmentIds,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

    // Verify refresh token was generated
    if (!refreshToken) {
      this.logger.error(
        `[AuthService] Failed to generate refresh token for user: ${user.email}`,
      );
      throw new Error('Failed to generate refresh token');
    }

    // Update only token-related fields to avoid accidentally overwriting
    // other columns (e.g., password) when the caller passes a partial entity.
    const refreshTokenExpireAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );

    await this.userRepository.update(user.id, {
      refreshToken,
      refreshTokenCreatedAt: new Date(),
      refreshTokenExpireAt,
    });

    // Keep the in-memory object consistent for the response.
    user.refreshToken = refreshToken;
    user.refreshTokenCreatedAt = new Date();
    user.refreshTokenExpireAt = refreshTokenExpireAt;

    this.logger.log(
      `[AuthService] Generated tokens for user: ${user.email}, RefreshToken length: ${refreshToken.length}`,
    );

    const response: AuthResponse = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        accessLevel: user.accessLevel,
        departmentId: user.departmentId,
        departmentIds: user.departmentIds,
      },
    };

    // Log to verify refresh token is in response
    this.logger.log(
      `[AuthService] generateAuthResponse - AccessToken: ${response.accessToken ? 'present' : 'missing'}, RefreshToken: ${response.refreshToken ? 'present' : 'missing'}`,
    );

    return response;
  }

  /**
   * Request password reset - sends email with reset link
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });

    // Always return success message (don't reveal if email exists)
    if (!user) {
      this.logger.log(
        `Password reset requested for non-existent email: ${email}`,
      );
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token (random 32-byte hex string)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await this.hashPassword(resetToken);

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Delete any existing reset tokens for this email
    await this.passwordResetRepository.delete({ email });

    // Store reset token
    const passwordReset = this.passwordResetRepository.create({
      email,
      token: tokenHash,
      expiresAt,
      used: false,
    });

    await this.passwordResetRepository.save(passwordReset);

    // Send reset email (queued in background)
    try {
      await this.emailQueueService.queuePasswordResetEmail(
        email,
        resetToken,
        user.name,
      );
    } catch {
      // Clean up token if email queue fails
      await this.passwordResetRepository.delete({ email });
      throw new BadRequestException(
        'Failed to queue password reset email. Please try again.',
      );
    }

    this.logger.log(`Password reset email queued for ${email}`);

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;

    // Find reset token (can't use hash for lookup, need to find all and compare)
    const resetRecords = await this.passwordResetRepository.find();
    let resetRecord: PasswordReset | null = null;

    for (const record of resetRecords) {
      const isMatch = await bcrypt.compare(token, record.token);
      if (isMatch) {
        resetRecord = record;
        break;
      }
    }

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    // Check if token is expired
    if (new Date() > resetRecord.expiresAt) {
      await this.passwordResetRepository.delete({ id: resetRecord.id });
      throw new BadRequestException(
        'Reset token has expired. Please request a new one.',
      );
    }

    // Check if token was already used
    if (resetRecord.used) {
      throw new BadRequestException('This reset token has already been used.');
    }

    // Find user
    const user = await this.userRepository.findOne({
      where: { email: resetRecord.email },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Update password
    user.password = await this.hashPassword(password);
    await this.userRepository.save(user);

    // Mark token as used and delete it
    await this.passwordResetRepository.delete({ id: resetRecord.id });

    this.logger.log(`Password reset successful for ${user.email}`);

    return {
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    };
  }
}
