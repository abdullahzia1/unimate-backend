import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../database/entities/device.entity';
import { NotificationLog } from '../../database/entities/notification-log.entity';
import { APNsConfigService } from './config/apns.config';
import { FCMConfigService } from './config/fcm.config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationLogService } from './services/notification-log.service';
import { PushNotificationService } from './services/push-notification.service';
import { APNsService } from './services/apns.service';
import { FCMService } from './services/fcm.service';
import { NotificationWorkerService } from './workers/notification-worker.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Device, NotificationLog])],
  controllers: [NotificationController],
  providers: [
    // Config services
    APNsConfigService,
    FCMConfigService,
    // Push notification services
    APNsService,
    FCMService,
    PushNotificationService,
    // Queue and worker
    NotificationQueueService,
    NotificationWorkerService,
    // Logging
    NotificationLogService,
    // Main service
    NotificationService,
  ],
  exports: [
    NotificationService,
    NotificationQueueService,
    NotificationLogService,
    PushNotificationService,
  ],
})
export class NotificationModule {}
