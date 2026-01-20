import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { PendingAccount } from '../../database/entities/pending-account.entity';
import { Announcement } from '../../database/entities/announcement.entity';
import { Device } from '../../database/entities/device.entity';
import { CleanupOptionsDto } from './dto/cleanup-options.dto';

export interface DataSummary {
  timetables: number;
  timetableHistory: number;
  departments: number;
  adminAccounts: number;
  pendingAccounts: number;
  announcements: number;
  devices: number;
  byDepartment?: Record<
    string,
    {
      timetables: number;
      timetableHistory: number;
      announcements: number;
      devices: number;
    }
  >;
}

export interface CleanupResults {
  success: boolean;
  deleted: {
    timetables?: number;
    timetableHistory?: number;
    departments?: number;
    adminAccounts?: number;
    pendingAccounts?: number;
    announcements?: number;
    devices?: number;
  };
  errors: Array<{ category: string; error: string }>;
}

@Injectable()
export class CleaningService {
  private readonly logger = new Logger(CleaningService.name);

  constructor(
    @InjectRepository(Timetable)
    private timetableRepository: Repository<Timetable>,
    @InjectRepository(TimetableHistory)
    private timetableHistoryRepository: Repository<TimetableHistory>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PendingAccount)
    private pendingAccountRepository: Repository<PendingAccount>,
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  /**
   * Get data summary
   */
  async getDataSummary(departmentIds: string[] | null): Promise<DataSummary> {
    const summary: DataSummary = {
      timetables: 0,
      timetableHistory: 0,
      departments: 0,
      adminAccounts: 0,
      pendingAccounts: 0,
      announcements: 0,
      devices: 0,
    };

    try {
      if (departmentIds === null) {
        // Global summary
        summary.timetables = await this.timetableRepository.count();
        summary.timetableHistory =
          await this.timetableHistoryRepository.count();
        summary.departments = await this.departmentRepository.count();
        summary.adminAccounts = await this.userRepository.count({
          where: {
            accessLevel: In(['super', 'supreme', 'head', 'multi', 'custodian']),
          },
        });
        summary.pendingAccounts = await this.pendingAccountRepository.count();
        summary.announcements = await this.announcementRepository.count();
        summary.devices = await this.deviceRepository.count();
      } else {
        // Department-specific summary
        summary.timetables = await this.timetableRepository.count({
          where: { departmentId: In(departmentIds) },
        });
        summary.timetableHistory = await this.timetableHistoryRepository.count({
          where: { departmentId: In(departmentIds) },
        });
        summary.announcements = await this.announcementRepository
          .createQueryBuilder('announcement')
          .where(
            'announcement.targetDepartmentIds && ARRAY[:...deptIds]::text[]',
            {
              deptIds: departmentIds,
            },
          )
          .getCount();
        summary.devices = await this.deviceRepository.count({
          where: { departmentId: In(departmentIds) },
        });

        // Global counts (not department-specific)
        summary.departments = await this.departmentRepository.count();
        summary.adminAccounts = await this.userRepository.count({
          where: {
            accessLevel: In(['super', 'supreme', 'head', 'multi', 'custodian']),
          },
        });
        summary.pendingAccounts = await this.pendingAccountRepository.count();

        // By department breakdown
        summary.byDepartment = {};
        for (const deptId of departmentIds) {
          summary.byDepartment[deptId] = {
            timetables: await this.timetableRepository.count({
              where: { departmentId: deptId },
            }),
            timetableHistory: await this.timetableHistoryRepository.count({
              where: { departmentId: deptId },
            }),
            announcements: await this.announcementRepository
              .createQueryBuilder('announcement')
              .where(
                'announcement.targetDepartmentIds @> ARRAY[:deptId]::text[]',
                {
                  deptId,
                },
              )
              .getCount(),
            devices: await this.deviceRepository.count({
              where: { departmentId: deptId },
            }),
          };
        }
      }
    } catch (error) {
      this.logger.error('Error getting data summary:', error);
      throw error;
    }

    return summary;
  }

  /**
   * Perform cleanup
   */
  async performCleanup(options: CleanupOptionsDto): Promise<CleanupResults> {
    const results: CleanupResults = {
      success: true,
      deleted: {},
      errors: [],
    };

    const departmentIds = options.departmentIds || null;

    try {
      // Cleanup timetables
      if (options.timetables) {
        try {
          const query = this.timetableRepository.createQueryBuilder();
          if (departmentIds) {
            query.where('departmentId IN (:...departmentIds)', {
              departmentIds,
            });
          }
          const deleteResult = await query.delete().execute();
          results.deleted.timetables = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'timetables',
            error: errorMessage,
          });
        }
      }

      // Cleanup timetable history
      if (options.timetableHistory) {
        try {
          const query = this.timetableHistoryRepository.createQueryBuilder();
          if (departmentIds) {
            query.where('departmentId IN (:...departmentIds)', {
              departmentIds,
            });
          }
          const deleteResult = await query.delete().execute();
          results.deleted.timetableHistory = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'timetableHistory',
            error: errorMessage,
          });
        }
      }

      // Cleanup departments
      if (options.departments) {
        try {
          const query = this.departmentRepository.createQueryBuilder();
          if (departmentIds) {
            query.where('id IN (:...departmentIds)', { departmentIds });
          }
          const deleteResult = await query.delete().execute();
          results.deleted.departments = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'departments',
            error: errorMessage,
          });
        }
      }

      // Cleanup admin accounts
      if (options.adminAccounts) {
        try {
          const query = this.userRepository
            .createQueryBuilder()
            .where('accessLevel IN (:...levels)', {
              levels: ['super', 'supreme', 'head', 'multi', 'custodian'],
            });
          const deleteResult = await query.delete().execute();
          results.deleted.adminAccounts = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'adminAccounts',
            error: errorMessage,
          });
        }
      }

      // Cleanup pending accounts
      if (options.pendingAccounts) {
        try {
          const deleteResult = await this.pendingAccountRepository.delete({});
          results.deleted.pendingAccounts = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'pendingAccounts',
            error: errorMessage,
          });
        }
      }

      // Cleanup announcements
      if (options.announcements) {
        try {
          const query = this.announcementRepository.createQueryBuilder();
          if (departmentIds) {
            query.where(
              'targetDepartmentIds && ARRAY[:...departmentIds]::text[]',
              {
                departmentIds,
              },
            );
          }
          const deleteResult = await query.delete().execute();
          results.deleted.announcements = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'announcements',
            error: errorMessage,
          });
        }
      }

      // Cleanup FCM tokens
      if (options.fcmTokens) {
        try {
          const query = this.deviceRepository.createQueryBuilder();
          if (departmentIds) {
            query.where('departmentId IN (:...departmentIds)', {
              departmentIds,
            });
          }
          const deleteResult = await query.delete().execute();
          results.deleted.devices = deleteResult.affected || 0;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            category: 'fcmTokens',
            error: errorMessage,
          });
        }
      }

      // Mark as unsuccessful if there are errors
      if (results.errors.length > 0) {
        results.success = false;
      }

      this.logger.log(`Cleanup completed: ${JSON.stringify(results.deleted)}`);
    } catch (error: unknown) {
      this.logger.error('Error performing cleanup:', error);
      results.success = false;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({
        category: 'general',
        error: errorMessage,
      });
    }

    return results;
  }
}
