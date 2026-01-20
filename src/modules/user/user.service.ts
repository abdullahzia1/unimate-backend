import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  AccessLevel,
  User,
  UserStatus,
} from '../../database/entities/user.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create an admin account
   */
  async createAccount(
    createAccountDto: CreateAccountDto,
    createdBy: string,
  ): Promise<string> {
    const {
      email,
      name,
      phone,
      accessLevel,
      departmentId,
      departmentIds,
      password,
    } = createAccountDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Validate department requirements
    if (
      (accessLevel === AccessLevel.HEAD ||
        accessLevel === AccessLevel.CUSTODIAN) &&
      !departmentId
    ) {
      throw new BadRequestException(
        'Department ID is required for Head and Custodian accounts',
      );
    }

    if (accessLevel === AccessLevel.MULTI) {
      if (!departmentIds || departmentIds.length === 0) {
        throw new BadRequestException(
          'At least one department ID is required for multi accounts',
        );
      }
    }

    // Generate password if not provided
    const passwordHash = password
      ? await this.hashPassword(password)
      : await this.hashPassword(this.generateRandomPassword());

    // Create user
    const userData: Partial<User> = {
      email,
      name,
      phone,
      password: passwordHash,
      accessLevel,
      departmentId:
        accessLevel === AccessLevel.MULTI ? undefined : departmentId,
      departmentIds:
        accessLevel === AccessLevel.MULTI ? departmentIds : undefined,
      status: UserStatus.ACTIVE,
      createdBy,
    };
    const user = this.userRepository.create(userData);

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`Admin account created: ${email} by ${createdBy}`);

    return savedUser.id;
  }

  /**
   * Update an admin account
   */
  async updateAccount(
    id: string,
    updateAccountDto: UpdateAccountDto,
    updatedBy: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate department requirements if access level is being changed
    if (updateAccountDto.accessLevel) {
      if (
        (updateAccountDto.accessLevel === AccessLevel.HEAD ||
          updateAccountDto.accessLevel === AccessLevel.CUSTODIAN) &&
        !updateAccountDto.departmentId &&
        !user.departmentId
      ) {
        throw new BadRequestException(
          'Department ID is required for Head and Custodian accounts',
        );
      }

      if (updateAccountDto.accessLevel === AccessLevel.MULTI) {
        if (
          (!updateAccountDto.departmentIds ||
            updateAccountDto.departmentIds.length === 0) &&
          (!user.departmentIds || user.departmentIds.length === 0)
        ) {
          throw new BadRequestException(
            'At least one department ID is required for multi accounts',
          );
        }
      }
    }

    // Update user
    await this.userRepository.update(id, {
      ...updateAccountDto,
      updatedAt: new Date(),
    });

    this.logger.log(`Admin account updated: ${id} by ${updatedBy}`);
  }

  /**
   * Delete an admin account
   */
  async deleteAccount(id: string, deletedBy: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user);
    this.logger.log(`Admin account deleted: ${id} by ${deletedBy}`);
  }

  /**
   * Get admin accounts (hierarchical based on access level)
   */
  async getAdminAccounts(
    requesterAccessLevel: AccessLevel | null,
    requesterDepartmentId?: string | null,
  ): Promise<User[]> {
    let query = this.userRepository
      .createQueryBuilder('user')
      .where('user.accessLevel IS NOT NULL');

    // Filter based on requester's access level
    if (requesterAccessLevel === AccessLevel.SUPER) {
      // Super can see everyone
      // No additional filter
    } else if (requesterAccessLevel === AccessLevel.SUPREME) {
      // Supreme can see everyone except super
      query = query.andWhere('user.accessLevel != :super', {
        super: AccessLevel.SUPER,
      });
    } else if (requesterAccessLevel === AccessLevel.HEAD) {
      // Head can see custodian in their department
      query = query
        .andWhere('user.accessLevel = :custodian', {
          custodian: AccessLevel.CUSTODIAN,
        })
        .andWhere('user.departmentId = :departmentId', {
          departmentId: requesterDepartmentId,
        });
    } else {
      // Custodian cannot see anyone
      return [];
    }

    return query.getMany();
  }

  /**
   * Change password (admin-initiated)
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(id, { password: passwordHash });

    this.logger.log(`Password changed for user: ${id}`);
  }

  /**
   * Change own password (self-service)
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('User does not have a password set');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update password
    const passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(userId, { password: passwordHash });

    this.logger.log(`User changed own password: ${userId}`);
  }

  /**
   * Repair orphaned account (creates password for existing account)
   */
  async repairOrphanedAccount(id: string, tempPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password) {
      throw new BadRequestException('User already has a password set');
    }

    const passwordHash = await this.hashPassword(tempPassword);
    await this.userRepository.update(id, { password: passwordHash });

    this.logger.log(`Orphaned account repaired: ${id}`);
  }

  /**
   * Get user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Get user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Generate random password
   */
  private generateRandomPassword(): string {
    const length = 16;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
