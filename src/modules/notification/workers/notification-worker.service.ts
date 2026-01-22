import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationQueueService } from '../services/notification-queue.service';
import { PushNotificationService } from '../services/push-notification.service';
import { NotificationLogService } from '../services/notification-log.service';
import { NotificationJob } from '../interfaces/push-message.interface';

@Injectable()
export class NotificationWorkerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorkerService.name);

  constructor(
    private notificationQueue: NotificationQueueService,
    private pushNotificationService: PushNotificationService,
    private notificationLogService: NotificationLogService,
  ) {}

  async onModuleInit() {
    await this.startWorkers();
    this.logger.log('Notification workers started');
  }

  /**
   * Start processing all notification queues
   */
  private async startWorkers(): Promise<void> {
    const queues = this.notificationQueue.getQueues();

    // Process timetable notifications
    await queues.timetable.process(async (job) => {
      return await this.processNotificationJob(job.data, 'timetable');
    });

    // Process custom notifications
    await queues.custom.process(async (job) => {
      return await this.processNotificationJob(job.data, 'custom');
    });

    // Process announcement notifications
    await queues.announcement.process(async (job) => {
      return await this.processNotificationJob(job.data, 'announcement');
    });
  }

  /**
   * Process a single notification job
   */
  private async processNotificationJob(
    job: NotificationJob,
    queueType: 'timetable' | 'custom' | 'announcement',
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(
      `Processing ${queueType} notification: ${job.tokens.length} tokens`,
    );

    try {
      // Group tokens by platform for efficient sending
      const platformGroups = this.groupTokensByPlatform(
        job.tokens,
        job.platform,
      );

      let totalDelivered = 0;
      let totalFailed = 0;
      const allInvalidTokens: string[] = [];

      // Send notifications for each platform
      for (const [platform, tokens] of Object.entries(platformGroups)) {
        if (tokens.length === 0) continue;

        const result = await this.pushNotificationService.sendToTokens(
          tokens,
          platform as 'ios' | 'android' | 'web',
          job.payload,
        );

        totalDelivered += result.deliveredTo;
        totalFailed += result.failedCount;
        allInvalidTokens.push(...result.invalidTokens);

        this.logger.debug(
          `[${platform}] Delivered: ${result.deliveredTo}, Failed: ${result.failedCount}`,
        );
      }

      // Clean up invalid tokens
      if (allInvalidTokens.length > 0) {
        await this.pushNotificationService.cleanupInvalidTokens(
          allInvalidTokens,
        );
      }

      // Log notification result
      const duration = Date.now() - startTime;
      await this.notificationLogService.logNotification({
        type: queueType,
        departmentId: job.departmentId,
        totalDevices: job.tokens.length,
        deliveredTo: totalDelivered,
        failedCount: totalFailed,
        invalidTokens: allInvalidTokens.length,
        duration,
        metadata: job.metadata,
      });

      this.logger.log(
        `[${queueType}] Notification processed: ${totalDelivered} delivered, ${totalFailed} failed (${duration}ms)`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${queueType}] Failed to process notification job`,
        error,
      );

      // Log failure
      await this.notificationLogService.logNotification({
        type: queueType,
        departmentId: job.departmentId,
        totalDevices: job.tokens.length,
        deliveredTo: 0,
        failedCount: job.tokens.length,
        invalidTokens: 0,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: job.metadata,
      });

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Group tokens by platform
   * If platform is specified in job, use that for all tokens
   * Otherwise, we'd need to look up from database (not implemented here)
   */
  private groupTokensByPlatform(
    tokens: string[],
    platform: 'ios' | 'android' | 'web',
  ): Record<string, string[]> {
    // For now, we use the platform from the job
    // In a more sophisticated implementation, we could look up each token's platform
    // from the database, but that would be inefficient for large batches
    return {
      [platform]: tokens,
    };
  }
}
