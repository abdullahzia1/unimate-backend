import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Device } from '../../../database/entities/device.entity';
import { APNsService } from './apns.service';
import { FCMService } from './fcm.service';
import {
  NotificationPlatform,
  PushNotificationPayload,
  BatchPushNotificationResult,
} from '../interfaces/push-message.interface';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private apnsService: APNsService,
    private fcmService: FCMService,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  /**
   * Send notification to tokens, automatically routing by platform
   */
  async sendToTokens(
    tokens: string[],
    platform: NotificationPlatform,
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    if (tokens.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    try {
      if (platform === 'ios') {
        if (!this.apnsService.isConfigured()) {
          this.logger.warn('APNs not configured, skipping iOS notifications');
          return this.createEmptyResult(tokens);
        }
        return await this.apnsService.sendToTokens(tokens, payload);
      } else if (platform === 'android') {
        if (!this.fcmService.isConfigured()) {
          this.logger.warn(
            'FCM not configured, skipping Android notifications',
          );
          return this.createEmptyResult(tokens);
        }
        return await this.fcmService.sendToTokens(tokens, payload);
      } else {
        this.logger.warn(`Unsupported platform: ${platform}`);
        return this.createEmptyResult(tokens);
      }
    } catch (error) {
      this.logger.error('Failed to send push notifications', error);
      return {
        deliveredTo: 0,
        failedCount: tokens.length,
        totalDevices: tokens.length,
        invalidTokens: [],
        results: tokens.map((token) => ({
          success: false,
          token,
          error: {
            code: 'send_error',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        })),
      };
    }
  }

  /**
   * Send notification to devices by platform, automatically grouping
   */
  async sendToDevices(
    devices: Array<{ token: string; platform: NotificationPlatform }>,
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    if (devices.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    // Group devices by platform
    const iosDevices = devices
      .filter((d) => d.platform === 'ios')
      .map((d) => d.token);
    const androidDevices = devices
      .filter((d) => d.platform === 'android')
      .map((d) => d.token);

    const results: BatchPushNotificationResult = {
      deliveredTo: 0,
      failedCount: 0,
      totalDevices: devices.length,
      invalidTokens: [],
      results: [],
    };

    // Send to iOS devices
    if (iosDevices.length > 0) {
      const iosResult = await this.sendToTokens(iosDevices, 'ios', payload);
      results.deliveredTo += iosResult.deliveredTo;
      results.failedCount += iosResult.failedCount;
      results.invalidTokens.push(...iosResult.invalidTokens);
      results.results.push(...iosResult.results);
    }

    // Send to Android devices
    if (androidDevices.length > 0) {
      const androidResult = await this.sendToTokens(
        androidDevices,
        'android',
        payload,
      );
      results.deliveredTo += androidResult.deliveredTo;
      results.failedCount += androidResult.failedCount;
      results.invalidTokens.push(...androidResult.invalidTokens);
      results.results.push(...androidResult.results);
    }

    return results;
  }

  /**
   * Get devices by user IDs and send notifications
   */
  async sendToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    if (userIds.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    const devices = await this.deviceRepository.find({
      where: { userId: In(userIds) },
      select: ['token', 'platform'],
    });

    if (devices.length === 0) {
      this.logger.warn(`No devices found for users: ${userIds.join(', ')}`);
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    const deviceList = devices.map((d) => ({
      token: d.token,
      platform: (d.platform || 'android') as NotificationPlatform,
    }));

    return await this.sendToDevices(deviceList, payload);
  }

  /**
   * Get devices by department and send notifications
   */
  async sendToDepartment(
    departmentId: string,
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    const devices = await this.deviceRepository.find({
      where: { departmentId },
      select: ['token', 'platform'],
    });

    if (devices.length === 0) {
      this.logger.warn(`No devices found for department: ${departmentId}`);
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    const deviceList = devices.map((d) => ({
      token: d.token,
      platform: (d.platform || 'android') as NotificationPlatform,
    }));

    return await this.sendToDevices(deviceList, payload);
  }

  /**
   * Get devices by multiple departments and send notifications
   */
  async sendToDepartments(
    departmentIds: string[],
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    if (departmentIds.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    const devices = await this.deviceRepository.find({
      where: { departmentId: In(departmentIds) },
      select: ['token', 'platform'],
    });

    // Remove duplicates by token
    const uniqueDevices = new Map<
      string,
      { token: string; platform: NotificationPlatform }
    >();
    devices.forEach((d) => {
      if (!uniqueDevices.has(d.token)) {
        uniqueDevices.set(d.token, {
          token: d.token,
          platform: (d.platform || 'android') as NotificationPlatform,
        });
      }
    });

    if (uniqueDevices.size === 0) {
      this.logger.warn(
        `No devices found for departments: ${departmentIds.join(', ')}`,
      );
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    return await this.sendToDevices(
      Array.from(uniqueDevices.values()),
      payload,
    );
  }

  /**
   * Get all devices and send notifications (global)
   */
  async sendToAll(
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    const devices = await this.deviceRepository.find({
      select: ['token', 'platform'],
    });

    if (devices.length === 0) {
      this.logger.warn('No devices found for global notification');
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
        invalidTokens: [],
        results: [],
      };
    }

    // Remove duplicates by token
    const uniqueDevices = new Map<
      string,
      { token: string; platform: NotificationPlatform }
    >();
    devices.forEach((d) => {
      if (!uniqueDevices.has(d.token)) {
        uniqueDevices.set(d.token, {
          token: d.token,
          platform: (d.platform || 'android') as NotificationPlatform,
        });
      }
    });

    return await this.sendToDevices(
      Array.from(uniqueDevices.values()),
      payload,
    );
  }

  /**
   * Clean up invalid tokens from database
   */
  async cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
    if (invalidTokens.length === 0) {
      return;
    }

    try {
      await this.deviceRepository.delete({
        token: In(invalidTokens),
      });
      this.logger.log(
        `Cleaned up ${invalidTokens.length} invalid device tokens`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup invalid tokens', error);
    }
  }

  /**
   * Create empty result for failed sends
   */
  private createEmptyResult(tokens: string[]): BatchPushNotificationResult {
    return {
      deliveredTo: 0,
      failedCount: tokens.length,
      totalDevices: tokens.length,
      invalidTokens: [],
      results: tokens.map((token) => ({
        success: false,
        token,
        error: {
          code: 'not_configured',
          message: 'Push notification service not configured',
        },
      })),
    };
  }

  /**
   * Check if any push service is configured
   */
  isConfigured(): boolean {
    return this.apnsService.isConfigured() || this.fcmService.isConfigured();
  }
}
