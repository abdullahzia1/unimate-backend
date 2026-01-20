import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Department,
  DepartmentStatus,
} from '../../database/entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
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

    await this.departmentRepository.remove(department);
    this.logger.log(`Department deleted: ${id} by ${deletedBy}`);
  }
}
