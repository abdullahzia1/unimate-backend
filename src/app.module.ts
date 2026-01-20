import {
  Module,
  type CanActivate,
  type DynamicModule,
  type Type,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AccountApprovalModule } from './modules/account-approval/account-approval.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { CleaningModule } from './modules/cleaning/cleaning.module';
import { DepartmentModule } from './modules/department/department.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { HistoryModule } from './modules/history/history.module';
import { MultimodalChatModule } from './modules/multimodal-chat/multimodal-chat.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ScreenshotAnalysisModule } from './modules/screenshot-analysis/screenshot-analysis.module';
import { UrlAnalysisModule } from './modules/url-analysis/url-analysis.module';
import { UrlSafetyModule } from './modules/url-safety/url-safety.module';
import { UserModule } from './modules/user/user.module';
import { VoiceAssistantModule } from './modules/voice-assistant/voice-assistant.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';

// Interface for ThrottlerModule's forRootAsync method
interface ThrottlerModuleInterface {
  forRootAsync: (options: {
    useFactory: () => {
      throttlers: Array<{
        name: string;
        ttl: number;
        limit: number;
      }>;
    };
  }) => DynamicModule;
}

const createThrottlerModule = (): DynamicModule => {
  const throttlerConfig = {
    throttlers: [
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'auth',
        ttl: 900000, // 15 minutes
        limit: 100, // 100 requests per 15 minutes for auth endpoints
      },
    ],
  };

  const ThrottlerModuleClass = ThrottlerModule as ThrottlerModuleInterface;

  return ThrottlerModuleClass.forRootAsync({
    useFactory: () => throttlerConfig,
  });
};

@Module({
  imports: [
    ConfigModule,
    createThrottlerModule(),
    DatabaseModule,
    AuthModule,
    UserModule,
    AccountApprovalModule,
    DepartmentModule,
    AnnouncementModule,
    TimetableModule,
    NotificationModule,
    CleaningModule,
    HealthModule,
    HistoryModule,
    BillingModule,
    ScreenshotAnalysisModule,
    UrlAnalysisModule,
    UrlSafetyModule,
    MultimodalChatModule,
    VoiceAssistantModule,
    WaitlistModule,
    ReferralsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard as Type<CanActivate>,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
