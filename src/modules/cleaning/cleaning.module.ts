import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../../database/entities/announcement.entity';
import { Department } from '../../database/entities/department.entity';
import { Device } from '../../database/entities/device.entity';
import { PendingAccount } from '../../database/entities/pending-account.entity';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { User } from '../../database/entities/user.entity';
import { CleaningController } from './cleaning.controller';
import { CleaningService } from './cleaning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Timetable,
      TimetableHistory,
      Department,
      User,
      PendingAccount,
      Announcement,
      Device,
    ]),
  ],
  controllers: [CleaningController],
  providers: [CleaningService],
  exports: [CleaningService],
})
export class CleaningModule {}
