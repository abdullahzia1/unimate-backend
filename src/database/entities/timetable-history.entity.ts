import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('timetable_history')
export class TimetableHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true })
  version: number;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  status: string;

  @Column('jsonb', { nullable: true })
  processingSteps: Array<{
    step: string;
    status: 'success' | 'failed' | 'info';
    details: string;
    timestamp?: Date;
  }>;

  @Column('jsonb', { nullable: true })
  anomalies: Array<{
    classCode: string;
    originalMissing: string[];
    inferredValues: Record<string, string>;
    methodUsed: string;
    fixed: boolean;
    availableData?: Record<string, string>;
  }>;

  @Column('jsonb', { nullable: true })
  clashes: {
    classes?: Array<{
      classCode: string;
      day: string;
      startTime: string;
      entries: Array<{
        day: string;
        subject: string;
        teacher: string;
        room: string;
        timeSlot: string;
      }>;
    }>;
    teachers?: Array<{
      teacher: string;
      day: string;
      startTime: string;
      entries: Array<{
        day: string;
        subject: string;
        classCode: string;
        room: string;
        timeSlot: string;
      }>;
    }>;
  };

  @Column({ nullable: true })
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedBy' })
  uploader: User;

  @Column({ nullable: true })
  uploadedByName: string;

  @CreateDateColumn()
  createdAt: Date;
}
