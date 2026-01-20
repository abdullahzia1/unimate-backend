import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../database/entities/announcement.entity';
import { validateDepartmentAccess } from '../../common/utils/access-control.util';
import { UserAccess } from '../../modules/auth/interfaces/auth.interface';
import { getDepartmentIds } from '../../common/utils/access-control.util';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
  ) {}

  /**
   * Create announcement
   */
  async createAnnouncement(
    createAnnouncementDto: CreateAnnouncementDto,
    createdBy: string,
    userAccess: UserAccess,
  ): Promise<string> {
    const { targetDepartmentIds } = createAnnouncementDto;

    // Validate department access if specific departments
    if (targetDepartmentIds !== 'all' && Array.isArray(targetDepartmentIds)) {
      for (const deptId of targetDepartmentIds) {
        validateDepartmentAccess(userAccess, deptId);
      }
    }

    const announcement = this.announcementRepository.create({
      ...createAnnouncementDto,
      targetDepartmentIds:
        targetDepartmentIds === 'all'
          ? ['all']
          : Array.isArray(targetDepartmentIds)
            ? targetDepartmentIds
            : [targetDepartmentIds],
      createdBy,
    });

    const saved = await this.announcementRepository.save(announcement);
    this.logger.log(`Announcement created: ${saved.id} by ${createdBy}`);

    return saved.id;
  }

  /**
   * Get announcements (filtered by user's departments)
   */
  async getAnnouncements(
    userAccess: UserAccess,
    departmentId?: string,
  ): Promise<Announcement[]> {
    // Determine target departments
    const targetDepartments = departmentId
      ? [departmentId]
      : getDepartmentIds(userAccess).length > 0
        ? getDepartmentIds(userAccess)
        : [];

    let query = this.announcementRepository.createQueryBuilder('announcement');

    if (targetDepartments.length === 0) {
      // Get all announcements (global and all departments)
      // This is for Super/Supreme users viewing "all departments"
      query = query.where(
        "announcement.targetDepartmentIds @> ARRAY['all']::text[] OR array_length(announcement.targetDepartmentIds, 1) > 0",
      );
    } else if (targetDepartments.length === 1) {
      // Get announcements for single department (including global)
      query = query.where(
        "announcement.targetDepartmentIds @> ARRAY['all']::text[] OR announcement.targetDepartmentIds @> ARRAY[:deptId]::text[]",
        { deptId: targetDepartments[0] },
      );
    } else {
      // Get announcements for multiple departments
      query = query.where(
        "announcement.targetDepartmentIds @> ARRAY['all']::text[] OR announcement.targetDepartmentIds && ARRAY[:...deptIds]::text[]",
        { deptIds: targetDepartments },
      );
    }

    return query.orderBy('announcement.createdAt', 'DESC').getMany();
  }

  /**
   * Update announcement
   */
  async updateAnnouncement(
    id: string,
    departmentId: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    userAccess: UserAccess,
  ): Promise<void> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // Validate department access
    validateDepartmentAccess(userAccess, departmentId);

    // Update announcement
    await this.announcementRepository.update(id, {
      ...updateAnnouncementDto,
      updatedAt: new Date(),
    });

    this.logger.log(`Announcement updated: ${id}`);
  }

  /**
   * Delete announcement
   */
  async deleteAnnouncement(
    id: string,
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<void> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // Validate department access
    validateDepartmentAccess(userAccess, departmentId);

    await this.announcementRepository.remove(announcement);
    this.logger.log(`Announcement deleted: ${id}`);
  }

  /**
   * Pin announcement
   */
  async pinAnnouncement(
    id: string,
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<void> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    validateDepartmentAccess(userAccess, departmentId);

    await this.announcementRepository.update(id, {
      isPinned: true,
      updatedAt: new Date(),
    });

    this.logger.log(`Announcement pinned: ${id}`);
  }

  /**
   * Unpin announcement
   */
  async unpinAnnouncement(
    id: string,
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<void> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    validateDepartmentAccess(userAccess, departmentId);

    await this.announcementRepository.update(id, {
      isPinned: false,
      updatedAt: new Date(),
    });

    this.logger.log(`Announcement unpinned: ${id}`);
  }
}
