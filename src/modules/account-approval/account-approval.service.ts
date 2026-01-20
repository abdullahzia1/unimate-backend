import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  AccessLevel,
  User,
  UserStatus,
} from '../../database/entities/user.entity';
import {
  PendingAccount,
  PendingAccountStatus,
} from '../../database/entities/pending-account.entity';
import { canApprove } from '../../common/utils/access-control.util';
import { CreatePendingAccountDto } from './dto/create-pending-account.dto';

@Injectable()
export class AccountApprovalService {
  private readonly logger = new Logger(AccountApprovalService.name);

  constructor(
    @InjectRepository(PendingAccount)
    private pendingAccountRepository: Repository<PendingAccount>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Create a pending account request
   */
  async createPendingAccount(
    createPendingAccountDto: CreatePendingAccountDto,
  ): Promise<string> {
    const { email, name, phone, requestedAccessLevel, requestedDepartmentId } =
      createPendingAccountDto;

    // Validate access level
    const validLevels = [
      AccessLevel.SUPREME,
      AccessLevel.HEAD,
      AccessLevel.CUSTODIAN,
    ];
    if (!validLevels.includes(requestedAccessLevel)) {
      throw new BadRequestException('Invalid access level for pending account');
    }

    // Head and Custodian require department
    if (
      (requestedAccessLevel === AccessLevel.HEAD ||
        requestedAccessLevel === AccessLevel.CUSTODIAN) &&
      !requestedDepartmentId
    ) {
      throw new BadRequestException(
        'Department is required for Head and Custodian accounts',
      );
    }

    // Check if email already exists in users
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Check if pending account already exists
    const existingPending = await this.pendingAccountRepository.findOne({
      where: { email },
    });
    if (existingPending) {
      throw new BadRequestException('Pending account request already exists');
    }

    // Generate a unique UID for the pending account
    const uid = this.generateUid();

    // Create pending account
    const pendingAccount = this.pendingAccountRepository.create({
      uid,
      email,
      name,
      phone,
      requestedAccessLevel,
      requestedDepartmentId,
      status: PendingAccountStatus.PENDING,
    });

    const saved = await this.pendingAccountRepository.save(pendingAccount);

    this.logger.log(`Pending account created: ${email}`);

    return saved.id;
  }

  /**
   * Get pending accounts (filtered by approver's access level)
   */
  async getPendingAccounts(
    approverAccessLevel: AccessLevel | null,
  ): Promise<PendingAccount[]> {
    if (!approverAccessLevel) {
      return [];
    }

    // Get all pending accounts
    const pendingAccounts = await this.pendingAccountRepository.find({
      where: { status: PendingAccountStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    // Filter by what the approver can approve
    return pendingAccounts.filter((account) =>
      canApprove(approverAccessLevel, account.requestedAccessLevel),
    );
  }

  /**
   * Approve a pending account
   */
  async approveAccount(
    id: string,
    approverId: string,
    approverAccessLevel: AccessLevel | null,
  ): Promise<void> {
    const pendingAccount = await this.pendingAccountRepository.findOne({
      where: { id },
    });

    if (!pendingAccount) {
      throw new NotFoundException('Pending account not found');
    }

    if (pendingAccount.status !== PendingAccountStatus.PENDING) {
      throw new BadRequestException('Account is not in pending status');
    }

    // Check if approver can approve this level
    if (!canApprove(approverAccessLevel, pendingAccount.requestedAccessLevel)) {
      throw new BadRequestException(
        'You do not have permission to approve accounts with this access level',
      );
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: pendingAccount.email },
    });

    if (existingUser) {
      // User already exists, just mark as approved and update
      existingUser.accessLevel = pendingAccount.requestedAccessLevel;
      existingUser.departmentId =
        pendingAccount.requestedDepartmentId ?? undefined;
      existingUser.status = UserStatus.ACTIVE;
      existingUser.approvedBy = approverId;
      existingUser.approvedAt = new Date();
      await this.userRepository.save(existingUser);
    } else {
      // Create new user
      const userData: Partial<User> = {
        email: pendingAccount.email,
        name: pendingAccount.name,
        phone: pendingAccount.phone,
        accessLevel: pendingAccount.requestedAccessLevel,
        departmentId: pendingAccount.requestedDepartmentId ?? undefined,
        status: UserStatus.ACTIVE,
        approvedBy: approverId,
        approvedAt: new Date(),
        // Note: Password is not set during account approval
        // User will need to use the password reset flow to set their initial password
      };
      const user = this.userRepository.create(userData);

      await this.userRepository.save(user);
    }

    // Update pending account status
    pendingAccount.status = PendingAccountStatus.APPROVED;
    pendingAccount.approvedBy = approverId;
    pendingAccount.approvedAt = new Date();
    await this.pendingAccountRepository.save(pendingAccount);

    this.logger.log(
      `Pending account approved: ${pendingAccount.email} by ${approverId}`,
    );
  }

  /**
   * Reject a pending account
   */
  async rejectAccount(
    id: string,
    approverId: string,
    approverAccessLevel: AccessLevel | null,
  ): Promise<void> {
    const pendingAccount = await this.pendingAccountRepository.findOne({
      where: { id },
    });

    if (!pendingAccount) {
      throw new NotFoundException('Pending account not found');
    }

    if (pendingAccount.status !== PendingAccountStatus.PENDING) {
      throw new BadRequestException('Account is not in pending status');
    }

    // Check if approver can approve this level (same permission check)
    if (!canApprove(approverAccessLevel, pendingAccount.requestedAccessLevel)) {
      throw new BadRequestException(
        'You do not have permission to reject accounts with this access level',
      );
    }

    // Update pending account status
    pendingAccount.status = PendingAccountStatus.REJECTED;
    pendingAccount.rejectedBy = approverId;
    pendingAccount.rejectedAt = new Date();
    await this.pendingAccountRepository.save(pendingAccount);

    this.logger.log(
      `Pending account rejected: ${pendingAccount.email} by ${approverId}`,
    );
  }

  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Generate a unique user ID
   */
  private generateUid(): string {
    // Generate a UUID-like string for the user identifier
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
