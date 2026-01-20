import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload, UserAccess } from '../auth/interfaces/auth.interface';
import { RequireDepartmentAccess } from '../../common/decorators/department-access.decorator';
import { DepartmentAccessGuard } from '../../common/guards/department-access.guard';
import { TimetableService } from './timetable.service';

@Controller('timetables')
@UseGuards(JwtAuthGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  /**
   * Get timetable history
   */
  @Get('history')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async getTimetableHistory(
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const history = await this.timetableService.getTimetableHistory(
      departmentId,
      userAccess,
    );

    return {
      success: true,
      history,
    };
  }

  /**
   * Delete timetable
   */
  @Delete(':id')
  async deleteTimetable(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    await this.timetableService.deleteTimetable(id, userAccess);

    return {
      success: true,
      message: 'Timetable deleted successfully',
    };
  }
}
