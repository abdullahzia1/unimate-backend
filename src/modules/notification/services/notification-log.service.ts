import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../../../database/entities/notification-log.entity';

export interface LogNotificationParams {
  type: 'timetable' | 'custom' | 'announcement';
  departmentId?: string;
  totalDevices: number;
  deliveredTo: number;
  failedCount: number;
  invalidTokens: number;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationLogService {
  private readonly logger = new Logger(NotificationLogService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
  ) {}

  /**
   * Log a notification result
   */
  async logNotification(
    params: LogNotificationParams,
  ): Promise<NotificationLog> {
    try {
      const log = this.notificationLogRepository.create({
        type: params.type,
        departmentId: params.departmentId,
        totalDevices: params.totalDevices,
        deliveredTo: params.deliveredTo,
        failedCount: params.failedCount,
        invalidTokens: params.invalidTokens,
        duration: params.duration,
        error: params.error,
        metadata: params.metadata,
        success: params.failedCount === 0,
      });

      return await this.notificationLogRepository.save(log);
    } catch (error) {
      this.logger.error('Failed to log notification', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getStatistics(
    departmentId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    totalDevices: number;
    deliveredTo: number;
    averageDuration: number;
  }> {
    const query = this.notificationLogRepository.createQueryBuilder('log');

    if (departmentId) {
      query.where('log.departmentId = :departmentId', { departmentId });
    }

    if (startDate) {
      query.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('log.createdAt <= :endDate', { endDate });
    }

    const logs: NotificationLog[] = await query.getMany();

    const total = logs.length;
    const successful = logs.filter((l) => l.success).length;
    const failed = total - successful;
    const totalDevices = logs.reduce((sum, l) => sum + l.totalDevices, 0);
    const deliveredTo = logs.reduce((sum, l) => sum + l.deliveredTo, 0);
    const averageDuration =
      logs.length > 0
        ? logs.reduce((sum, l) => sum + l.duration, 0) / logs.length
        : 0;

    return {
      total,
      successful,
      failed,
      totalDevices,
      deliveredTo,
      averageDuration: Math.round(averageDuration),
    };
  }

  /**
   * Get recent notification logs
   */
  async getRecentLogs(
    limit: number = 50,
    departmentId?: string,
  ): Promise<NotificationLog[]> {
    const query = this.notificationLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (departmentId) {
      query.where('log.departmentId = :departmentId', { departmentId });
    }

    return await query.getMany();
  }
}
