import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OAuthProvider {
  LOCAL = 'local',
}

export enum AccessLevel {
  SUPER = 'super',
  SUPREME = 'supreme',
  HEAD = 'head',
  MULTI = 'multi',
  CUSTODIAN = 'custodian',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string; // Hashed password for local auth

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'enum',
    enum: OAuthProvider,
    default: OAuthProvider.LOCAL,
  })
  provider: OAuthProvider;

  @Column({ nullable: true, unique: true })
  providerId: string; // OAuth provider user ID

  @Column({
    type: 'enum',
    enum: AccessLevel,
    nullable: true,
  })
  accessLevel: AccessLevel | null;

  @Column({ nullable: true })
  departmentId: string; // For Head/Custodian (single department)

  @Column('text', { array: true, nullable: true })
  departmentIds: string[]; // For multi accounts

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  createdBy: string; // User ID who created this account

  @Column({ nullable: true })
  approvedBy: string; // User ID who approved this account

  @Column({ nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  refreshTokenCreatedAt: Date;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  refreshTokenExpireAt: Date;
  isActive: any;
  referralCode: any;
}
