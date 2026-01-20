import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccessLevel } from './user.entity';

export enum PendingAccountStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('pending_accounts')
export class PendingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  uid: string; // Firebase Auth UID

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: AccessLevel,
  })
  requestedAccessLevel: AccessLevel;

  @Column({ nullable: true })
  requestedDepartmentId: string;

  @Column({
    type: 'enum',
    enum: PendingAccountStatus,
    default: PendingAccountStatus.PENDING,
  })
  status: PendingAccountStatus;

  @Column({ nullable: true })
  approvedBy: string; // User ID who approved

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  rejectedBy: string; // User ID who rejected

  @Column({ nullable: true })
  rejectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
