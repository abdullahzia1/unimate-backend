import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Queue from 'bull';
import { NotificationJob } from '../interfaces/push-message.interface';

@Injectable()
export class NotificationQueueService implements OnModuleInit {
  private readonly logger = new Logger(NotificationQueueService.name);
  private timetableQueue: Queue.Queue<NotificationJob>;
  private customQueue: Queue.Queue<NotificationJob>;
  private announcementQueue: Queue.Queue<NotificationJob>;

  constructor(private configService: ConfigService) {
    const redisConfigObj = this.configService.get<{
      host: string;
      port: number;
    }>('redis');
    const redisConfig = {
      host: redisConfigObj?.host || 'localhost',
      port: redisConfigObj?.port || 6379,
    };

    const queueOptions: Queue.QueueOptions = {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    };

    // Create separate queues for different notification types
    // This allows better isolation and priority management
    this.timetableQueue = new Queue('notification-timetable', queueOptions);
    this.customQueue = new Queue('notification-custom', queueOptions);
    this.announcementQueue = new Queue(
      'notification-announcement',
      queueOptions,
    );

    this.setupQueueEventHandlers();
  }

  onModuleInit() {
    this.logger.log('Notification queue service initialized');
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupQueueEventHandlers(): void {
    const queues = [
      { name: 'timetable', queue: this.timetableQueue },
      { name: 'custom', queue: this.customQueue },
      { name: 'announcement', queue: this.announcementQueue },
    ];

    queues.forEach(({ name, queue }) => {
      queue.on('completed', (job) => {
        this.logger.debug(
          `[${name}] Job ${job.id} completed: ${job.data.tokens.length} tokens`,
        );
      });

      queue.on('failed', (job, err) => {
        this.logger.error(
          `[${name}] Job ${job?.id} failed: ${err.message}`,
          err.stack,
        );
      });

      queue.on('stalled', (job) => {
        this.logger.warn(`[${name}] Job ${job.id} stalled`);
      });

      queue.on('error', (error) => {
        this.logger.error(
          `[${name}] Queue error: ${error.message}`,
          error.stack,
        );
      });
    });
  }

  /**
   * Queue timetable notification
   */
  async queueTimetableNotification(
    tokens: string[],
    platform: 'ios' | 'android' | 'web',
    payload: {
      title: string;
      body: string;
      data?: Record<string, string | number | boolean>;
    },
    departmentId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const job: NotificationJob = {
      type: 'timetable',
      tokens,
      platform,
      payload,
      departmentId,
      metadata,
    };

    await this.timetableQueue.add(job, {
      priority: 1, // High priority for timetable updates
    });

    this.logger.log(
      `Timetable notification queued: ${tokens.length} tokens, department: ${departmentId || 'N/A'}`,
    );
  }

  /**
   * Queue custom notification
   */
  async queueCustomNotification(
    tokens: string[],
    platform: 'ios' | 'android' | 'web',
    payload: {
      title: string;
      body: string;
      data?: Record<string, string | number | boolean>;
    },
    metadata?: Record<string, any>,
  ): Promise<void> {
    const job: NotificationJob = {
      type: 'custom',
      tokens,
      platform,
      payload,
      metadata,
    };

    await this.customQueue.add(job, {
      priority: 2, // Normal priority for custom notifications
    });

    this.logger.log(`Custom notification queued: ${tokens.length} tokens`);
  }

  /**
   * Queue announcement notification
   */
  async queueAnnouncementNotification(
    tokens: string[],
    platform: 'ios' | 'android' | 'web',
    payload: {
      title: string;
      body: string;
      data?: Record<string, string | number | boolean>;
    },
    metadata?: Record<string, any>,
  ): Promise<void> {
    const job: NotificationJob = {
      type: 'announcement',
      tokens,
      platform,
      payload,
      metadata,
    };

    await this.announcementQueue.add(job, {
      priority: 1, // High priority for announcements
    });

    this.logger.log(
      `Announcement notification queued: ${tokens.length} tokens`,
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    timetable: Queue.JobCounts;
    custom: Queue.JobCounts;
    announcement: Queue.JobCounts;
  }> {
    return {
      timetable: await this.timetableQueue.getJobCounts(),
      custom: await this.customQueue.getJobCounts(),
      announcement: await this.announcementQueue.getJobCounts(),
    };
  }

  /**
   * Get queues for worker processing
   */
  getQueues(): {
    timetable: Queue.Queue<NotificationJob>;
    custom: Queue.Queue<NotificationJob>;
    announcement: Queue.Queue<NotificationJob>;
  } {
    return {
      timetable: this.timetableQueue,
      custom: this.customQueue,
      announcement: this.announcementQueue,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.timetableQueue.clean(3600000, 'completed', 1000), // 1 hour
        this.customQueue.clean(3600000, 'completed', 1000),
        this.announcementQueue.clean(3600000, 'completed', 1000),
        this.timetableQueue.clean(86400000, 'failed', 100), // 24 hours
        this.customQueue.clean(86400000, 'failed', 100),
        this.announcementQueue.clean(86400000, 'failed', 100),
      ]);
      this.logger.log('Notification queues cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup notification queues', error);
    }
  }

  /**
   * Close all queues (for graceful shutdown)
   */
  async close(): Promise<void> {
    await Promise.all([
      this.timetableQueue.close(),
      this.customQueue.close(),
      this.announcementQueue.close(),
    ]);
    this.logger.log('Notification queues closed');
  }
}
