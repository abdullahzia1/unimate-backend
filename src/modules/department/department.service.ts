import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Department,
  DepartmentStatus,
} from '../../database/entities/department.entity';
import { AvailableOptions } from '../../database/entities/available-options.entity';
import { User } from '../../database/entities/user.entity';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { Announcement } from '../../database/entities/announcement.entity';
import { Device } from '../../database/entities/device.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(AvailableOptions)
    private availableOptionsRepository: Repository<AvailableOptions>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Timetable)
    private timetableRepository: Repository<Timetable>,
    @InjectRepository(TimetableHistory)
    private timetableHistoryRepository: Repository<TimetableHistory>,
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  /**
   * Create a department
   */
  async createDepartment(
    createDepartmentDto: CreateDepartmentDto,
    createdBy: string,
  ): Promise<string> {
    const { id, name, code, description, color } = createDepartmentDto;

    // Check if department already exists
    const existing = await this.departmentRepository.findOne({
      where: { id },
    });

    if (existing) {
      throw new BadRequestException('Department with this ID already exists');
    }

    // Create department
    const department = this.departmentRepository.create({
      id,
      name,
      code,
      description,
      color,
      status: DepartmentStatus.ACTIVE,
      createdBy,
    });

    const saved = await this.departmentRepository.save(department);

    // Initialize AvailableOptions
    const availableOptions = this.availableOptionsRepository.create({
      departmentId: saved.id,
      courses: [],
      semesters: [],
      sections: [],
      teachers: [],
    });
    await this.availableOptionsRepository.save(availableOptions);

    this.logger.log(`Department created: ${id} by ${createdBy}`);

    return saved.id;
  }

  /**
   * Get all departments
   */
  async getDepartments(): Promise<Department[]> {
    return this.departmentRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(id: string): Promise<Department | null> {
    return this.departmentRepository.findOne({ where: { id } });
  }

  /**
   * Update a department
   */
  async updateDepartment(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
    updatedBy: string,
  ): Promise<void> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    await this.departmentRepository.update(id, {
      ...updateDepartmentDto,
      updatedAt: new Date(),
    });

    this.logger.log(`Department updated: ${id} by ${updatedBy}`);
  }

  /**
   * Delete a department
   */
  async deleteDepartment(id: string, deletedBy: string): Promise<void> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Cleanup: Update or delete accounts associated with this department
    // Set departmentId to null for users with this department
    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ departmentId: () => 'NULL' })
      .where('departmentId = :id', { id })
      .execute();

    // Remove from departmentIds array for multi-department users
    const multiUsers = await this.userRepository.find({
      where: {},
    });

    for (const user of multiUsers) {
      if (user.departmentIds && user.departmentIds.includes(id)) {
        const updatedIds = user.departmentIds.filter((deptId) => deptId !== id);
        await this.userRepository
          .createQueryBuilder()
          .update(User)
          .set({
            departmentIds: updatedIds.length > 0 ? updatedIds : [],
          })
          .where('id = :userId', { userId: user.id })
          .execute();
      }
    }

    // Delete related data
    await this.timetableRepository.delete({ departmentId: id });
    await this.timetableHistoryRepository.delete({ departmentId: id });

    // Delete announcements that target this department
    // Find announcements that include this department ID in their targetDepartmentIds array
    const announcements = await this.announcementRepository.find({
      where: {},
    });
    const announcementsToDelete = announcements.filter(
      (announcement) =>
        announcement.targetDepartmentIds.includes(id) ||
        announcement.targetDepartmentIds.includes('all'),
    );
    if (announcementsToDelete.length > 0) {
      await this.announcementRepository.delete({
        id: In(announcementsToDelete.map((a) => a.id)),
      });
    }

    await this.deviceRepository.delete({ departmentId: id });
    await this.availableOptionsRepository.delete({ departmentId: id });

    // Delete department
    await this.departmentRepository.remove(department);
    this.logger.log(`Department deleted: ${id} by ${deletedBy} (with cleanup)`);
  }

  /**
   * Get AvailableOptions for a department
   */
  async getAvailableOptions(
    departmentId: string,
  ): Promise<AvailableOptions | null> {
    return this.availableOptionsRepository.findOne({
      where: { departmentId },
    });
  }

  /**
   * Update AvailableOptions for a department
   */
  async updateAvailableOptions(
    departmentId: string,
    options: {
      courses?: string[];
      semesters?: string[];
      sections?: string[];
      teachers?: string[];
    },
  ): Promise<void> {
    const existing = await this.availableOptionsRepository.findOne({
      where: { departmentId },
    });

    if (existing) {
      // Merge with existing options
      const updatedOptions = {
        courses: options.courses
          ? Array.from(new Set([...existing.courses, ...options.courses]))
          : existing.courses,
        semesters: options.semesters
          ? Array.from(new Set([...existing.semesters, ...options.semesters]))
          : existing.semesters,
        sections: options.sections
          ? Array.from(new Set([...existing.sections, ...options.sections]))
          : existing.sections,
        teachers: options.teachers
          ? Array.from(new Set([...existing.teachers, ...options.teachers]))
          : existing.teachers,
      };

      await this.availableOptionsRepository.update(
        departmentId,
        updatedOptions,
      );
    } else {
      // Create new options
      const newOptions = this.availableOptionsRepository.create({
        departmentId,
        courses: options.courses || [],
        semesters: options.semesters || [],
        sections: options.sections || [],
        teachers: options.teachers || [],
      });
      await this.availableOptionsRepository.save(newOptions);
    }
  }
}
