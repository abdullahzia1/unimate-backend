import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { validateDepartmentAccess } from '../../common/utils/access-control.util';
import { UserAccess } from '../../modules/auth/interfaces/auth.interface';

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(
    @InjectRepository(Timetable)
    private timetableRepository: Repository<Timetable>,
    @InjectRepository(TimetableHistory)
    private timetableHistoryRepository: Repository<TimetableHistory>,
  ) {}

  /**
   * Get timetable history for a department
   */
  async getTimetableHistory(
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<TimetableHistory[]> {
    validateDepartmentAccess(userAccess, departmentId);

    return this.timetableHistoryRepository.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get timetable by ID
   */
  async getTimetableById(id: string): Promise<Timetable | null> {
    return this.timetableRepository.findOne({ where: { id } });
  }

  /**
   * Delete timetable
   */
  async deleteTimetable(id: string, userAccess: UserAccess): Promise<void> {
    const timetable = await this.timetableRepository.findOne({
      where: { id },
    });

    if (!timetable) {
      throw new NotFoundException('Timetable not found');
    }

    validateDepartmentAccess(userAccess, timetable.departmentId);

    await this.timetableRepository.remove(timetable);
    this.logger.log(`Timetable deleted: ${id}`);
  }

  /**
   * Create timetable history entry
   */
  async createTimetableHistory(
    departmentId: string,
    fileName: string,
    uploadedBy: string,
    uploadedByName: string,
    userAccess: UserAccess,
  ): Promise<string> {
    validateDepartmentAccess(userAccess, departmentId);

    const history = this.timetableHistoryRepository.create({
      departmentId,
      fileName,
      uploadedBy,
      uploadedByName,
      status: 'processing',
      processingSteps: [],
      anomalies: [],
      clashes: {},
    });

    const saved = await this.timetableHistoryRepository.save(history);
    this.logger.log(`Timetable history created: ${saved.id}`);

    return saved.id;
  }

  /**
   * Update timetable history
   */
  async updateTimetableHistory(
    id: string,
    updates: Partial<TimetableHistory>,
  ): Promise<void> {
    await this.timetableHistoryRepository.update(id, updates);
  }
}
