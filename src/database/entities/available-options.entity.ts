import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('available_options')
export class AvailableOptions {
  @PrimaryColumn()
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column('text', { array: true, default: [] })
  courses: string[];

  @Column('text', { array: true, default: [] })
  semesters: string[];

  @Column('text', { array: true, default: [] })
  sections: string[];

  @Column('text', { array: true, default: [] })
  teachers: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
