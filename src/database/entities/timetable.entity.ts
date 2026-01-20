import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('timetables')
export class Timetable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column('jsonb')
  data: {
    entries: Array<{
      day: string;
      time: string;
      subject: string;
      teacher: string;
      room: string;
      course?: string;
      semester?: string;
      section?: string;
    }>;
    metadata?: {
      teachers?: Record<string, string>;
      courses?: Record<string, string>;
      subjects?: Record<string, string>;
    };
  };

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
