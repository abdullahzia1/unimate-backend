import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload, UserAccess } from '../auth/interfaces/auth.interface';
import { RequireDepartmentAccess } from '../../common/decorators/department-access.decorator';
import { DepartmentAccessGuard } from '../../common/guards/department-access.guard';
import { AccessLevel } from '../../database/entities/user.entity';
import { RequireAccessLevel } from '../../common/decorators/access-level.decorator';
import { AccessLevelGuard } from '../../common/guards/access-level.guard';
import { TimetableService } from './timetable.service';
import { UploadTimetableDto } from './dto/upload-timetable.dto';
import { PreviewTimetableDto } from './dto/preview-timetable.dto';
import { UpdateTimetableEntriesDto } from './dto/update-timetable-entries.dto';
import { MergeSkippedClassesDto } from './dto/merge-skipped-classes.dto';
import { timetableUploadConfig } from './config/multer.config';

@Controller('timetables')
@UseGuards(JwtAuthGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  /**
   * Upload timetable file
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', timetableUploadConfig))
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async uploadTimetable(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadTimetableDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const result = await this.timetableService.processTimetable(
      file.buffer,
      uploadDto.departmentId,
      user.sub,
      uploadDto.filename || file.originalname,
      uploadDto.dividers,
      userAccess,
    );

    return {
      success: true,
      message: 'Timetable processed successfully',
      filename: uploadDto.filename || file.originalname,
      format:
        (uploadDto.filename || file.originalname)
          .split('.')
          .pop()
          ?.toUpperCase() || 'XLSX',
      historyId: result.historyId,
      steps: result.steps,
      skippedClasses: result.skippedClasses,
      processedClassesCount: result.processedClassesCount,
    };
  }

  /**
   * Generate preview from file
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file', timetableUploadConfig))
  previewTimetable(
    @UploadedFile() file: Express.Multer.File,
    @Body() previewDto: PreviewTimetableDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const preview = this.timetableService.generatePreview(
      file.buffer,
      previewDto.dividers,
    );

    return {
      success: true,
      preview,
    };
  }

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
   * Get timetable entries for editor
   */
  @Get('entries')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async getTimetableEntriesForEditor(
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const result = await this.timetableService.getTimetableEntriesForEditor(
      departmentId,
      userAccess,
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Update timetable entries from editor
   */
  @Put('entries')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async updateTimetableEntriesFromEditor(
    @Query('departmentId') departmentId: string,
    @Body() updateDto: UpdateTimetableEntriesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    await this.timetableService.updateTimetableEntriesFromEditor(
      departmentId,
      updateDto.entries,
      userAccess,
    );

    return {
      success: true,
      message: 'Timetable entries updated successfully',
    };
  }

  /**
   * Get skipped classes for a history entry
   */
  @Get(':historyId/skipped-classes')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async getSkippedClasses(
    @Param('historyId') historyId: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const skippedClasses = await this.timetableService.getSkippedClasses(
      departmentId,
      historyId,
      userAccess,
    );

    return {
      success: true,
      skippedClasses,
    };
  }

  /**
   * Merge skipped classes back into timetable
   */
  @Post(':historyId/merge-skipped')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async mergeSkippedClasses(
    @Param('historyId') historyId: string,
    @Query('departmentId') departmentId: string,
    @Body() mergeDto: MergeSkippedClassesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    await this.timetableService.mergeSkippedClasses(
      departmentId,
      historyId,
      mergeDto.skippedClasses,
      userAccess,
    );

    return {
      success: true,
      message: 'Skipped classes merged successfully',
    };
  }

  /**
   * Get timetable log (processing steps)
   */
  @Get(':historyId/log')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async getTimetableLog(
    @Param('historyId') historyId: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const log = await this.timetableService.getTimetableLog(
      departmentId,
      historyId,
      userAccess,
    );

    return {
      success: true,
      ...log,
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

  /**
   * Delete all timetables for a department
   */
  @Delete('all')
  @UseGuards(DepartmentAccessGuard, AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
  @RequireDepartmentAccess('departmentId')
  async deleteAllTimetables(
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    await this.timetableService.deleteAllTimetables(departmentId, userAccess);

    return {
      success: true,
      message: 'All timetables deleted successfully',
    };
  }
}
