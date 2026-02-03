import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../../database/entities/department.entity';
import { AvailableOptions } from '../../database/entities/available-options.entity';
import { User } from '../../database/entities/user.entity';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { Announcement } from '../../database/entities/announcement.entity';
import { Device } from '../../database/entities/device.entity';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      AvailableOptions,
      User,
      Timetable,
      TimetableHistory,
      Announcement,
      Device,
    ]),
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
