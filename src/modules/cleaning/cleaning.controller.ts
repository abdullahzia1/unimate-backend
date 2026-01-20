import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { AccessLevelGuard } from '../../common/guards/access-level.guard';
import { RequireAccessLevel } from '../../common/decorators/access-level.decorator';
import { AccessLevel } from '../../database/entities/user.entity';
import { CleanupOptionsDto } from './dto/cleanup-options.dto';
import { CleaningService } from './cleaning.service';

@Controller('cleaning')
@UseGuards(JwtAuthGuard, AccessLevelGuard)
@RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
export class CleaningController {
  constructor(private readonly cleaningService: CleaningService) {}

  /**
   * Get data summary
   */
  @Get('summary')
  async getDataSummary(
    @Query('departmentIds') departmentIds: string | string[],
    @CurrentUser() _user: JwtPayload,
  ) {
    // Parse department IDs
    let parsedDepartmentIds: string[] | null = null;
    if (departmentIds) {
      if (departmentIds === 'global' || departmentIds === 'null') {
        parsedDepartmentIds = null;
      } else if (Array.isArray(departmentIds)) {
        parsedDepartmentIds = departmentIds;
      } else if (typeof departmentIds === 'string') {
        parsedDepartmentIds = departmentIds
          .split(',')
          .filter((id) => id.trim().length > 0);
      }
    }

    const summary =
      await this.cleaningService.getDataSummary(parsedDepartmentIds);

    return {
      success: true,
      summary,
    };
  }

  /**
   * Perform cleanup
   */
  @Post('perform')
  async performCleanup(
    @Body() cleanupOptionsDto: CleanupOptionsDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    // Validate that at least one option is selected
    if (
      !cleanupOptionsDto.timetables &&
      !cleanupOptionsDto.departments &&
      !cleanupOptionsDto.adminAccounts &&
      !cleanupOptionsDto.pendingAccounts &&
      !cleanupOptionsDto.announcements &&
      !cleanupOptionsDto.fcmTokens
    ) {
      throw new Error('At least one cleanup option must be selected');
    }

    const results =
      await this.cleaningService.performCleanup(cleanupOptionsDto);

    return {
      success: results.success,
      results: results.deleted,
      errors: results.errors,
    };
  }
}
