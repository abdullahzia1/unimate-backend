import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload, UserAccess } from '../auth/interfaces/auth.interface';
import { RequireDepartmentAccess } from '../../common/decorators/department-access.decorator';
import { DepartmentAccessGuard } from '../../common/guards/department-access.guard';
import { getDepartmentIds } from '../../common/utils/access-control.util';
import {
  SendAnnouncementNotificationDto,
  SendCustomNotificationDto,
  SendTimetableNotificationDto,
} from './dto/send-notification.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Send timetable notification
   */
  @Post('timetable')
  @UseGuards(DepartmentAccessGuard)
  @RequireDepartmentAccess('departmentId')
  async sendTimetableNotification(
    @Body() sendTimetableNotificationDto: SendTimetableNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    const result = await this.notificationService.sendTimetableNotification(
      sendTimetableNotificationDto.departmentId,
      sendTimetableNotificationDto.timetableId || '',
      userAccess,
    );

    return {
      success: true,
      message: 'Timetable notification sent successfully',
      deliveredTo: result.deliveredTo,
      failedCount: result.failedCount,
      totalDevices: result.totalDevices,
    };
  }

  /**
   * Send custom notification
   */
  @Post('custom')
  async sendCustomNotification(
    @Body() sendCustomNotificationDto: SendCustomNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    // Determine target departments
    const isGlobal =
      sendCustomNotificationDto.target === 'global' ||
      (!sendCustomNotificationDto.departmentId &&
        (!sendCustomNotificationDto.departmentIds ||
          sendCustomNotificationDto.departmentIds.length === 0));

    const targetDepartments = isGlobal
      ? 'all'
      : Array.isArray(sendCustomNotificationDto.departmentIds) &&
          sendCustomNotificationDto.departmentIds.length > 0
        ? sendCustomNotificationDto.departmentIds
        : sendCustomNotificationDto.departmentId
          ? [sendCustomNotificationDto.departmentId]
          : getDepartmentIds(userAccess).length > 0
            ? getDepartmentIds(userAccess)
            : 'all';

    const result = await this.notificationService.sendCustomNotification(
      targetDepartments,
      sendCustomNotificationDto.title,
      sendCustomNotificationDto.body,
      sendCustomNotificationDto.data,
      userAccess,
    );

    return {
      success: true,
      deliveredTo: result.deliveredTo,
      failedCount: result.failedCount,
      totalDevices: result.totalDevices,
    };
  }

  /**
   * Send announcement notification
   */
  @Post('announcement')
  async sendAnnouncementNotification(
    @Body() sendAnnouncementNotificationDto: SendAnnouncementNotificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const userAccess: UserAccess = {
      accessLevel: user.accessLevel || null,
      departmentId: user.departmentId || null,
      departmentIds: user.departmentIds || [],
    };

    // Determine target departments
    const isGlobal =
      sendAnnouncementNotificationDto.target === 'global' ||
      !sendAnnouncementNotificationDto.departmentIds ||
      sendAnnouncementNotificationDto.departmentIds.length === 0;

    const targetDepartments = isGlobal
      ? 'all'
      : sendAnnouncementNotificationDto.departmentIds &&
          sendAnnouncementNotificationDto.departmentIds.length > 0
        ? sendAnnouncementNotificationDto.departmentIds
        : getDepartmentIds(userAccess).length > 0
          ? getDepartmentIds(userAccess)
          : 'all';

    const result = await this.notificationService.sendAnnouncementNotification(
      sendAnnouncementNotificationDto.announcementText,
      targetDepartments,
      userAccess,
    );

    return {
      success: true,
      message: 'Announcement notification sent successfully',
      deliveredTo: result.deliveredTo,
      failedCount: result.failedCount,
    };
  }

  /**
   * Get device count
   */
  @Get('devices/count')
  async getDeviceCount(
    @Query('departmentIds') departmentIds: string | string[],
    @Query('target') target: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    const isGlobal = target === 'global' || !departmentIds;
    const targetDepartments = isGlobal
      ? 'all'
      : Array.isArray(departmentIds)
        ? departmentIds
        : typeof departmentIds === 'string'
          ? [departmentIds]
          : 'all';

    const count =
      await this.notificationService.getDeviceCount(targetDepartments);

    return {
      success: true,
      count,
    };
  }

  /**
   * Register FCM token
   */
  @Post('devices/token')
  async registerToken(
    @Body('token') token: string,
    @Body('platform') platform: string,
    @Body('departmentId') departmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.notificationService.registerToken(
      user.sub,
      token,
      platform,
      departmentId,
    );

    return {
      success: true,
      message: 'FCM token registered successfully',
    };
  }
}
