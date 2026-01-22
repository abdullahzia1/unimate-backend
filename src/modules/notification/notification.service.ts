import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Device } from '../../database/entities/device.entity';
import { validateDepartmentAccess } from '../../common/utils/access-control.util';
import { UserAccess } from '../auth/interfaces/auth.interface';
import { NotificationQueueService } from './services/notification-queue.service';
import { PushNotificationService } from './services/push-notification.service';

export interface DeviceCount {
  students: number;
  teachers: number;
  total: number;
}

export interface NotificationResult {
  deliveredTo: number;
  failedCount: number;
  totalDevices: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    private notificationQueue: NotificationQueueService,
    private pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Get FCM tokens by department
   */
  async getTokensByDepartment(departmentId: string): Promise<string[]> {
    const devices = await this.deviceRepository.find({
      where: { departmentId },
      select: ['token'],
    });

    return devices.map((device) => device.token);
  }

  /**
   * Get FCM tokens by multiple departments
   */
  async getTokensByDepartments(departmentIds: string[]): Promise<string[]> {
    const devices = await this.deviceRepository.find({
      where: { departmentId: In(departmentIds) },
      select: ['token'],
    });

    // Remove duplicates
    const uniqueTokens = new Set(devices.map((device) => device.token));
    return Array.from(uniqueTokens);
  }

  /**
   * Get FCM tokens globally (all departments)
   */
  async getTokensByGlobal(): Promise<string[]> {
    const devices = await this.deviceRepository.find({
      select: ['token'],
    });

    // Remove duplicates
    const uniqueTokens = new Set(devices.map((device) => device.token));
    return Array.from(uniqueTokens);
  }

  /**
   * Send timetable notification (queued)
   */
  async sendTimetableNotification(
    departmentId: string,
    timetableId: string,
    userAccess: UserAccess,
  ): Promise<NotificationResult> {
    validateDepartmentAccess(userAccess, departmentId);

    const devices = await this.deviceRepository.find({
      where: { departmentId },
      select: ['token', 'platform'],
    });

    if (devices.length === 0) {
      this.logger.warn(`No devices found for department ${departmentId}`);
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // Group tokens by platform
    const iosTokens: string[] = [];
    const androidTokens: string[] = [];

    devices.forEach((device) => {
      const platform = (device.platform || 'android') as 'ios' | 'android';
      if (platform === 'ios') {
        iosTokens.push(device.token);
      } else {
        androidTokens.push(device.token);
      }
    });

    // Queue notifications for each platform
    const payload = {
      title: 'Timetable Updated',
      body: 'Your timetable has been updated. Tap to view changes.',
      data: {
        type: 'timetable',
        departmentId,
        timetableId,
      },
    };

    if (iosTokens.length > 0) {
      await this.notificationQueue.queueTimetableNotification(
        iosTokens,
        'ios',
        payload,
        departmentId,
        { timetableId },
      );
    }

    if (androidTokens.length > 0) {
      await this.notificationQueue.queueTimetableNotification(
        androidTokens,
        'android',
        payload,
        departmentId,
        { timetableId },
      );
    }

    this.logger.log(
      `Timetable notification queued: ${devices.length} devices in department ${departmentId}`,
    );

    return {
      deliveredTo: 0, // Will be updated by worker
      failedCount: 0,
      totalDevices: devices.length,
    };
  }

  /**
   * Send custom notification (queued)
   */
  async sendCustomNotification(
    targetDepartments: string[] | 'all',
    title: string,
    body: string,
    data?: Record<string, string>,
    userAccess?: UserAccess,
  ): Promise<NotificationResult> {
    // Validate department access if specific departments
    if (Array.isArray(targetDepartments) && userAccess) {
      for (const deptId of targetDepartments) {
        validateDepartmentAccess(userAccess, deptId);
      }
    }

    let devices: Device[] = [];

    if (targetDepartments === 'all') {
      devices = await this.deviceRepository.find({
        select: ['token', 'platform'],
      });
    } else {
      devices = await this.deviceRepository.find({
        where: { departmentId: In(targetDepartments) },
        select: ['token', 'platform'],
      });
    }

    // Remove duplicates by token
    const uniqueDevices = new Map<string, Device>();
    devices.forEach((d) => {
      if (!uniqueDevices.has(d.token)) {
        uniqueDevices.set(d.token, d);
      }
    });

    const deviceList = Array.from(uniqueDevices.values());

    if (deviceList.length === 0) {
      this.logger.warn('No devices found');
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // Group tokens by platform
    const iosTokens: string[] = [];
    const androidTokens: string[] = [];

    deviceList.forEach((device) => {
      const platform = (device.platform || 'android') as 'ios' | 'android';
      if (platform === 'ios') {
        iosTokens.push(device.token);
      } else {
        androidTokens.push(device.token);
      }
    });

    const payload = {
      title,
      body,
      data: data as Record<string, string | number | boolean> | undefined,
    };

    // Queue notifications for each platform
    if (iosTokens.length > 0) {
      await this.notificationQueue.queueCustomNotification(
        iosTokens,
        'ios',
        payload,
      );
    }

    if (androidTokens.length > 0) {
      await this.notificationQueue.queueCustomNotification(
        androidTokens,
        'android',
        payload,
      );
    }

    this.logger.log(`Custom notification queued: ${deviceList.length} devices`);

    return {
      deliveredTo: 0, // Will be updated by worker
      failedCount: 0,
      totalDevices: deviceList.length,
    };
  }

  /**
   * Send announcement notification (queued)
   */
  async sendAnnouncementNotification(
    announcementText: string,
    targetDepartments: string[] | 'all',
    userAccess?: UserAccess,
  ): Promise<NotificationResult> {
    // Validate department access if specific departments
    if (Array.isArray(targetDepartments) && userAccess) {
      for (const deptId of targetDepartments) {
        validateDepartmentAccess(userAccess, deptId);
      }
    }

    let devices: Device[] = [];

    if (targetDepartments === 'all') {
      devices = await this.deviceRepository.find({
        select: ['token', 'platform'],
      });
    } else {
      devices = await this.deviceRepository.find({
        where: { departmentId: In(targetDepartments) },
        select: ['token', 'platform'],
      });
    }

    // Remove duplicates by token
    const uniqueDevices = new Map<string, Device>();
    devices.forEach((d) => {
      if (!uniqueDevices.has(d.token)) {
        uniqueDevices.set(d.token, d);
      }
    });

    const deviceList = Array.from(uniqueDevices.values());

    if (deviceList.length === 0) {
      this.logger.warn('No devices found');
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // Truncate announcement text for notification
    const truncatedText =
      announcementText.length > 100
        ? announcementText.substring(0, 100) + '...'
        : announcementText;

    // Group tokens by platform
    const iosTokens: string[] = [];
    const androidTokens: string[] = [];

    deviceList.forEach((device) => {
      const platform = (device.platform || 'android') as 'ios' | 'android';
      if (platform === 'ios') {
        iosTokens.push(device.token);
      } else {
        androidTokens.push(device.token);
      }
    });

    const payload = {
      title: 'New Announcement',
      body: truncatedText,
      data: {
        type: 'announcement',
      },
    };

    // Queue notifications for each platform
    if (iosTokens.length > 0) {
      await this.notificationQueue.queueAnnouncementNotification(
        iosTokens,
        'ios',
        payload,
      );
    }

    if (androidTokens.length > 0) {
      await this.notificationQueue.queueAnnouncementNotification(
        androidTokens,
        'android',
        payload,
      );
    }

    this.logger.log(
      `Announcement notification queued: ${deviceList.length} devices`,
    );

    return {
      deliveredTo: 0, // Will be updated by worker
      failedCount: 0,
      totalDevices: deviceList.length,
    };
  }

  /**
   * Get device count
   */
  async getDeviceCount(departmentIds: string[] | 'all'): Promise<DeviceCount> {
    let devices: Device[] = [];

    if (departmentIds === 'all') {
      devices = await this.deviceRepository.find();
    } else {
      devices = await this.deviceRepository.find({
        where: { departmentId: In(departmentIds) },
      });
    }

    // Note: In a real implementation, you'd need to distinguish between students and teachers
    // This would require a user type field or joining with user data
    const total = devices.length;
    const students = Math.floor(total * 0.7); // Placeholder: assume 70% students
    const teachers = total - students;

    return {
      students,
      teachers,
      total,
    };
  }

  /**
   * Register FCM token
   */
  async registerToken(
    userId: string,
    token: string,
    platform?: string,
    departmentId?: string,
  ): Promise<void> {
    // Check if token already exists
    const existing = await this.deviceRepository.findOne({
      where: { userId, token },
    });

    if (existing) {
      // Update last active time
      await this.deviceRepository.update(existing.id, {
        lastActiveAt: new Date(),
        platform,
        departmentId,
      });
    } else {
      // Create new device record
      const device = this.deviceRepository.create({
        userId,
        token,
        platform,
        departmentId,
        lastActiveAt: new Date(),
      });

      await this.deviceRepository.save(device);
    }

    this.logger.log(`FCM token registered for user ${userId}`);
  }
}
