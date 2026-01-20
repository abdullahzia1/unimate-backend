import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Device } from '../../database/entities/device.entity';
import { validateDepartmentAccess } from '../../common/utils/access-control.util';
import { UserAccess } from '../auth/interfaces/auth.interface';

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
   * Send timetable notification
   * Note: Actual FCM sending would require firebase-admin SDK
   * This is a placeholder structure
   */
  async sendTimetableNotification(
    departmentId: string,
    timetableId: string,
    userAccess: UserAccess,
  ): Promise<NotificationResult> {
    validateDepartmentAccess(userAccess, departmentId);

    const tokens = await this.getTokensByDepartment(departmentId);

    if (tokens.length === 0) {
      this.logger.warn(`No FCM tokens found for department ${departmentId}`);
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // TODO: Implement actual FCM sending using firebase-admin
    // For now, this is a placeholder
    this.logger.log(
      `Would send timetable notification to ${tokens.length} devices in department ${departmentId}`,
    );

    return {
      deliveredTo: tokens.length,
      failedCount: 0,
      totalDevices: tokens.length,
    };
  }

  /**
   * Send custom notification
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

    let tokens: string[] = [];

    if (targetDepartments === 'all') {
      tokens = await this.getTokensByGlobal();
    } else {
      tokens = await this.getTokensByDepartments(targetDepartments);
    }

    if (tokens.length === 0) {
      this.logger.warn('No FCM tokens found');
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // TODO: Implement actual FCM sending using firebase-admin
    this.logger.log(
      `Would send custom notification to ${tokens.length} devices`,
    );

    return {
      deliveredTo: tokens.length,
      failedCount: 0,
      totalDevices: tokens.length,
    };
  }

  /**
   * Send announcement notification
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

    let tokens: string[] = [];

    if (targetDepartments === 'all') {
      tokens = await this.getTokensByGlobal();
    } else {
      tokens = await this.getTokensByDepartments(targetDepartments);
    }

    if (tokens.length === 0) {
      this.logger.warn('No FCM tokens found');
      return {
        deliveredTo: 0,
        failedCount: 0,
        totalDevices: 0,
      };
    }

    // TODO: Implement actual FCM sending using firebase-admin
    this.logger.log(
      `Would send announcement notification to ${tokens.length} devices`,
    );

    return {
      deliveredTo: tokens.length,
      failedCount: 0,
      totalDevices: tokens.length,
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
