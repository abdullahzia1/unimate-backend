import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DepartmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('departments')
export class Department {
  @PrimaryColumn()
  id: string; // e.g., 'CS', 'EE', etc.

  @Column()
  name: string;

  @Column()
  code: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  color: string; // HSL color string or Material UI color name

  @Column({
    type: 'enum',
    enum: DepartmentStatus,
    default: DepartmentStatus.ACTIVE,
  })
  status: DepartmentStatus;

  @Column({ nullable: true })
  createdBy: string; // User ID who created this department

  @Column({ nullable: true })
  lastTimetableUpdate: Date;

  @Column({ nullable: true })
  currentTimetableHistoryId: string;

  @Column({ nullable: true })
  currentTimetableUpdatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
