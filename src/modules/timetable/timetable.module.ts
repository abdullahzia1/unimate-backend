import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { Department } from '../../database/entities/department.entity';
import { AvailableOptions } from '../../database/entities/available-options.entity';
import { User } from '../../database/entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { DepartmentModule } from '../department/department.module';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { TimetableParserService } from './services/timetable-parser.service';
import { RuleBasedParserService } from './services/rule-based-parser.service';
import { ClassTimetableExportService } from './services/class-timetable-export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Timetable,
      TimetableHistory,
      Department,
      AvailableOptions,
      User,
    ]),
    StorageModule,
    NotificationModule,
    UserModule,
    DepartmentModule,
  ],
  controllers: [TimetableController],
  providers: [
    TimetableService,
    TimetableParserService,
    RuleBasedParserService,
    ClassTimetableExportService,
  ],
  exports: [TimetableService],
})
export class TimetableModule {}
