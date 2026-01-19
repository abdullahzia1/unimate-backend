import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ThrottleAuth, ThrottleRefresh } from './decorators/throttle.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  private readonly logger = new Logger(AuthController.name);

  /**
   * POST /auth/register
   * Send OTP for email verification
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return ApiResponse.success(result);
  }
  /**
   * POST /auth/verify-otp
   * Verify OTP and complete registration
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return ApiResponse.success(result);
  }

  /**
   * POST /auth/resend-otp
   * Resend OTP to email
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('resend-otp')
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    const result = await this.authService.resendOtp(resendOtpDto);
    return ApiResponse.success(result);
  }
  /**
   * POST /auth/login
   * Login with email/password
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    this.logger.log(`Login successful for email: ${loginDto.email}`);
    // Log to verify refresh token is in response
    this.logger.log(
      `Login response - AccessToken: ${result.accessToken ? 'present' : 'missing'}, RefreshToken: ${result.refreshToken ? 'present' : 'missing'}`,
    );
    return ApiResponse.success(result);
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    const userProfile = await this.authService.getUserById(user.sub);
    return ApiResponse.success({
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      avatar: userProfile.avatar,
      provider: userProfile.provider,
    });
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  @ThrottleRefresh() // 10 requests per minute for refresh
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );
    return ApiResponse.success(result);
  }

  /**
   * POST /auth/logout
   * Logout (client-side token removal, placeholder for future token blacklist)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return ApiResponse.success({ message: 'Logged out successfully' });
  }

  /**
   * POST /auth/forgot-password
   * Request password reset link
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(forgotPasswordDto);
    return ApiResponse.success(result);
  }

  /**
   * POST /auth/reset-password
   * Reset password using token
   */
  @ThrottleAuth() // 5 requests per 15 minutes
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(resetPasswordDto);
    return ApiResponse.success(result);
  }
}
