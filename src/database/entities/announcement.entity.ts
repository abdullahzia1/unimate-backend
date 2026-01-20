import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  publisherName: string;

  @Column()
  publisherIcon: string; // 'A', 'B', etc. or 'image'

  @Column({ nullable: true })
  publisherIconUrl: string; // URL if publisherIcon is 'image'

  @Column('text')
  text: string;

  @Column('text', { array: true, default: [] })
  imageUrls: string[];

  @Column({ default: false })
  isPinned: boolean;

  @Column({ default: false })
  verified: boolean;

  @Column('text', { array: true })
  targetDepartmentIds: string[]; // ['all'] or specific department IDs

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
