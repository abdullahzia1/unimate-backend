import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload, UserAccess } from '../auth/interfaces/auth.interface';
import { RequireDepartmentAccess } from '../../common/decorators/department-access.decorator';
import { DepartmentAccessGuard } from '../../common/guards/department-access.guard';
import { getDepartmentIds } from '../../common/utils/access-control.util';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementService } from './announcement.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  /**
   * Create announcement
   */
  @Post()
  async createAnnouncement(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const id = await this.announcementService.createAnnouncement(
      createAnnouncementDto,
      user.sub,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement created successfully',
      id,
    };
  }

  /**
   * Get announcements
   */
  @Get()
  async getAnnouncements(
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const announcements = await this.announcementService.getAnnouncements(
      userAccess,
      departmentId,
    );

    return {
      success: true,
      announcements,
    };
  }

  /**
   * Update announcement
   */
  @Put(':id')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const finalDepartmentId =
      departmentId ||
      getDepartmentIds(userAccess)[0] ||
      user.departmentId ||
      'CS';

    await this.announcementService.updateAnnouncement(
      id,
      finalDepartmentId,
      updateAnnouncementDto,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement updated successfully',
    };
  }

  /**
   * Delete announcement
   */
  @Delete(':id')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async deleteAnnouncement(
    @Param('id') id: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const finalDepartmentId =
      departmentId ||
      getDepartmentIds(userAccess)[0] ||
      user.departmentId ||
      'CS';

    await this.announcementService.deleteAnnouncement(
      id,
      finalDepartmentId,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement deleted successfully',
    };
  }

  /**
   * Pin announcement
   */
  @Post(':id/pin')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async pinAnnouncement(
    @Param('id') id: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const finalDepartmentId =
      departmentId ||
      getDepartmentIds(userAccess)[0] ||
      user.departmentId ||
      'CS';

    await this.announcementService.pinAnnouncement(
      id,
      finalDepartmentId,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement pinned successfully',
    };
  }

  /**
   * Unpin announcement
   */
  @Post(':id/unpin')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async unpinAnnouncement(
    @Param('id') id: string,
    @Query('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const finalDepartmentId =
      departmentId ||
      getDepartmentIds(userAccess)[0] ||
      user.departmentId ||
      'CS';

    await this.announcementService.unpinAnnouncement(
      id,
      finalDepartmentId,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement unpinned successfully',
    };
  }
}
