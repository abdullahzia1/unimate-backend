import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notification_logs')
@Index(['departmentId', 'createdAt'])
@Index(['type', 'createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['timetable', 'custom', 'announcement'],
  })
  type: 'timetable' | 'custom' | 'announcement';

  @Column({ nullable: true })
  departmentId: string;

  @Column({ type: 'int' })
  totalDevices: number;

  @Column({ type: 'int' })
  deliveredTo: number;

  @Column({ type: 'int' })
  failedCount: number;

  @Column({ type: 'int' })
  invalidTokens: number;

  @Column({ type: 'int' })
  duration: number; // Duration in milliseconds

  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
