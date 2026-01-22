import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Department } from './entities/department.entity';
import { Device } from './entities/device.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { OtpVerification } from './entities/otp-verification.entity';
import { PendingAccount } from './entities/pending-account.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { Timetable } from './entities/timetable.entity';
import { TimetableHistory } from './entities/timetable-history.entity';
import { User } from './entities/user.entity';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [
          User,
          Department,
          PendingAccount,
          Timetable,
          TimetableHistory,
          Announcement,
          Device,
          NotificationLog,
          OtpVerification,
          PasswordReset,
        ],
        synchronize: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false, // We handle migrations manually via MigrationService
        logging: configService.get('nodeEnv') === 'development',
        ssl: configService.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : undefined,
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Department,
      PendingAccount,
      Timetable,
      TimetableHistory,
      Announcement,
      Device,
      NotificationLog,
      OtpVerification,
      PasswordReset,
    ]),
  ],
  providers: [MigrationService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
