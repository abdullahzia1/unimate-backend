import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpVerification } from './entities/otp-verification.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { ReferralWithdrawal } from './entities/referral-withdrawal.entity';
import { ScanHistory } from './entities/scan-history.entity';
import { SecureLinkCheck } from './entities/secure-link-check.entity';
import { SpamUrl } from './entities/spam-url.entity';
import { User } from './entities/user.entity';
import { Waitlist } from './entities/waitlist.entity';
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
          ScanHistory,
          SecureLinkCheck,
          OtpVerification,
          PasswordReset,
          Waitlist,
          ReferralWithdrawal,
          SpamUrl,
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
      ScanHistory,
      SecureLinkCheck,
      OtpVerification,
      PasswordReset,
      Waitlist,
      ReferralWithdrawal,
      SpamUrl,
    ]),
  ],
  providers: [MigrationService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
