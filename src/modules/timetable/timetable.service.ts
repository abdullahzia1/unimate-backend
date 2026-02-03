import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Timetable } from '../../database/entities/timetable.entity';
import { TimetableHistory } from '../../database/entities/timetable-history.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { AvailableOptions } from '../../database/entities/available-options.entity';
import { DepartmentService } from '../department/department.service';
import { validateDepartmentAccess } from '../../common/utils/access-control.util';
import { UserAccess } from '../../modules/auth/interfaces/auth.interface';
import { TimetableParserService } from './services/timetable-parser.service';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import {
  ProcessingResult,
  TimetablePreview,
} from './interfaces/timetable.interface';
import { TimetableEntry } from './interfaces/timetable.interface';

@Injectable()
export class TimetableService {
  private readonly logger = new Logger(TimetableService.name);

  constructor(
    @InjectRepository(Timetable)
    private timetableRepository: Repository<Timetable>,
    @InjectRepository(TimetableHistory)
    private timetableHistoryRepository: Repository<TimetableHistory>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AvailableOptions)
    private availableOptionsRepository: Repository<AvailableOptions>,
    private timetableParser: TimetableParserService,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private userService: UserService,
    private departmentService: DepartmentService,
  ) {}

  /**
   * Process timetable file (parse, save, return result)
   */
  async processTimetable(
    fileBuffer: Buffer,
    departmentId: string,
    userId: string,
    fileName?: string,
    dividers?: number[],
    userAccess?: UserAccess,
  ): Promise<ProcessingResult> {
    if (userAccess) {
      validateDepartmentAccess(userAccess, departmentId);
    }

    const steps: Array<{
      step: string;
      status: 'success' | 'failed' | 'info';
      details: string;
    }> = [];

    try {
      // Get user name
      const user = await this.userService.findById(userId);
      const uploadedByName = user?.name || 'Unknown';

      // Create history entry
      const historyId = await this.createTimetableHistory(
        departmentId,
        fileName || 'upload.xlsx',
        userId,
        uploadedByName,
        userAccess || {
          accessLevel: null,
          departmentId: null,
          departmentIds: [],
        },
      );

      steps.push({
        step: 'Create history entry',
        status: 'success',
        details: `History ID: ${historyId}`,
      });

      // Convert Excel to CSV
      const csvData = this.timetableParser.excelToCsv(fileBuffer);
      steps.push({
        step: 'Convert Excel to CSV',
        status: 'success',
        details: `Converted ${fileBuffer.length} bytes to CSV`,
      });

      // Auto-detect dividers if not provided
      let effectiveDividers = dividers;
      if (!effectiveDividers || effectiveDividers.length === 0) {
        effectiveDividers = this.timetableParser.autoDetectDividers(csvData);
        steps.push({
          step: 'Auto-detect dividers',
          status: 'info',
          details: `Detected ${effectiveDividers.length} divider(s)`,
        });
      }

      // Parse timetable
      const parsed = this.timetableParser.parseTimetableFromCSV(
        csvData,
        effectiveDividers,
      );

      const parsedClassesCount = parsed.classes.length;
      steps.push({
        step: 'Parse timetable',
        status: parsedClassesCount > 0 ? 'success' : 'info',
        details: `Parsed ${parsedClassesCount} classes`,
      });

      // Extract metadata
      const metadata =
        this.timetableParser.extractMetadataFromExcel(fileBuffer);

      // Transform to timetable entries
      const entries: TimetableEntry[] = parsed.classes.map((cls) => ({
        day: cls.day,
        time: cls.timeSlot,
        subject: cls.subject,
        teacher: cls.teacher,
        room: cls.room,
        course: cls.course,
        semester: cls.semester,
        section: cls.section,
      }));

      // Identify skipped classes (entries missing required fields)
      const skippedClasses = entries
        .filter(
          (entry) =>
            !entry.day ||
            !entry.room ||
            !entry.time ||
            !entry.subject ||
            !entry.teacher,
        )
        .map((entry) => ({
          classCode: entry.course
            ? `${entry.course}${entry.semester || ''}${entry.section || ''}`
            : '',
          subject: entry.subject || '',
          teacher: entry.teacher || '',
          reason: this.getSkippedReason(entry),
        }));

      // Filter valid entries
      const validEntries = entries.filter(
        (entry) =>
          entry.day &&
          entry.room &&
          entry.time &&
          entry.subject &&
          entry.teacher,
      );

      // Save timetable to database
      const timetable = this.timetableRepository.create({
        departmentId,
        data: {
          entries: validEntries,
          metadata,
        },
        createdBy: userId,
      });

      await this.timetableRepository.save(timetable);

      // Upload file to S3
      if (this.storageService.isConfigured()) {
        try {
          await this.storageService.uploadTimetableFile(
            departmentId,
            timetable.id,
            fileBuffer,
            fileName || 'upload.xlsx',
          );
          steps.push({
            step: 'Upload to S3',
            status: 'success',
            details: 'File uploaded to S3',
          });
        } catch (error) {
          this.logger.warn('Failed to upload to S3', error);
          steps.push({
            step: 'Upload to S3',
            status: 'failed',
            details: 'Failed to upload file to S3',
          });
        }
      }

      // Update history
      await this.updateTimetableHistory(historyId, {
        status: 'completed',
        processingSteps: steps,
        anomalies: [],
        clashes: this.detectClashes(validEntries),
      });

      // Update department
      await this.departmentRepository.update(departmentId, {
        lastTimetableUpdate: new Date(),
        currentTimetableHistoryId: historyId,
        currentTimetableUpdatedAt: new Date(),
      });

      // Update AvailableOptions
      const availableOptions: {
        courses?: string[];
        semesters?: string[];
        sections?: string[];
        teachers?: string[];
      } = {
        courses: parsed.courses,
        semesters: parsed.semesters,
        sections: parsed.sections,
        teachers: parsed.teachers,
      };
      const deptService: DepartmentService = this.departmentService;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- DepartmentService type not resolved in this module (DI); updateAvailableOptions is typed
      await deptService.updateAvailableOptions(departmentId, availableOptions);

      steps.push({
        step: 'Save timetable',
        status: 'success',
        details: `Saved ${validEntries.length} entries`,
      });

      return {
        historyId,
        steps,
        skippedClasses,
        processedClassesCount: validEntries.length,
      };
    } catch (error) {
      this.logger.error('Failed to process timetable', error);
      throw new BadRequestException(
        `Failed to process timetable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get skipped classes for a history entry
   */
  async getSkippedClasses(
    departmentId: string,
    historyId: string,
    userAccess: UserAccess,
  ): Promise<
    Array<{
      classCode: string;
      subject: string;
      teacher: string;
      reason: string;
    }>
  > {
    validateDepartmentAccess(userAccess, departmentId);

    const history = await this.timetableHistoryRepository.findOne({
      where: { id: historyId, departmentId },
    });

    if (!history) {
      throw new NotFoundException('Timetable history not found');
    }

    // Extract skipped classes from processing steps or anomalies
    const skippedClasses: Array<{
      classCode: string;
      subject: string;
      teacher: string;
      reason: string;
    }> = [];

    // Check if skipped classes are stored in history
    // For now, we'll extract from anomalies or return empty
    if (history.anomalies) {
      history.anomalies.forEach((anomaly) => {
        if (!anomaly.fixed) {
          skippedClasses.push({
            classCode: anomaly.classCode,
            subject: anomaly.availableData?.subject || '',
            teacher: anomaly.availableData?.teacher || '',
            reason: `Missing: ${anomaly.originalMissing.join(', ')}`,
          });
        }
      });
    }

    return skippedClasses;
  }

  /**
   * Merge skipped classes back into timetable
   */
  async mergeSkippedClasses(
    departmentId: string,
    historyId: string,
    skippedClasses: Array<{
      classCode: string;
      subject: string;
      teacher: string;
      day: string;
      time: string;
      room: string;
      course?: string;
      semester?: string;
      section?: string;
    }>,
    userAccess: UserAccess,
  ): Promise<void> {
    validateDepartmentAccess(userAccess, departmentId);

    const history = await this.timetableHistoryRepository.findOne({
      where: { id: historyId, departmentId },
    });

    if (!history) {
      throw new NotFoundException('Timetable history not found');
    }

    // Get current timetable
    const timetables = await this.timetableRepository.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (timetables.length === 0) {
      throw new NotFoundException('No timetable found for this department');
    }

    const timetable = timetables[0];

    // Add skipped classes as entries
    const newEntries: TimetableEntry[] = skippedClasses.map((cls) => ({
      day: cls.day,
      time: cls.time,
      subject: cls.subject,
      teacher: cls.teacher,
      room: cls.room,
      course: cls.course,
      semester: cls.semester,
      section: cls.section,
    }));

    // Merge with existing entries
    timetable.data.entries = [...timetable.data.entries, ...newEntries];

    await this.timetableRepository.save(timetable);

    this.logger.log(
      `Merged ${skippedClasses.length} skipped classes into timetable`,
    );
  }

  /**
   * Get timetable log (processing steps)
   */
  async getTimetableLog(
    departmentId: string,
    historyId: string,
    userAccess: UserAccess,
  ): Promise<{
    steps: Array<{
      step: string;
      status: 'success' | 'failed' | 'info';
      details: string;
      timestamp?: Date;
    }>;
    anomalies: Array<{
      classCode: string;
      originalMissing: string[];
      inferredValues: Record<string, string>;
      methodUsed: string;
      fixed: boolean;
    }>;
    clashes: {
      classes?: Array<any>;
      teachers?: Array<any>;
    };
  }> {
    validateDepartmentAccess(userAccess, departmentId);

    const history = await this.timetableHistoryRepository.findOne({
      where: { id: historyId, departmentId },
    });

    if (!history) {
      throw new NotFoundException('Timetable history not found');
    }

    return {
      steps: history.processingSteps || [],
      anomalies: history.anomalies || [],
      clashes: history.clashes || {},
    };
  }

  /**
   * Get timetable entries for editor
   */
  async getTimetableEntriesForEditor(
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<{
    entries: TimetableEntry[];
    metadata?: {
      teachers?: Record<string, string>;
      courses?: Record<string, string>;
      subjects?: Record<string, string>;
    };
  }> {
    validateDepartmentAccess(userAccess, departmentId);

    const timetables = await this.timetableRepository.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (timetables.length === 0) {
      return {
        entries: [],
      };
    }

    const timetable = timetables[0];

    return {
      entries: timetable.data.entries || [],
      metadata: timetable.data.metadata,
    };
  }

  /**
   * Update timetable entries from editor
   */
  async updateTimetableEntriesFromEditor(
    departmentId: string,
    entries: TimetableEntry[],
    userAccess: UserAccess,
  ): Promise<void> {
    validateDepartmentAccess(userAccess, departmentId);

    const timetables = await this.timetableRepository.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (timetables.length === 0) {
      throw new NotFoundException('No timetable found for this department');
    }

    const timetable = timetables[0];
    timetable.data.entries = entries;

    await this.timetableRepository.save(timetable);

    this.logger.log(
      `Updated timetable entries from editor: ${entries.length} entries`,
    );
  }

  /**
   * Delete all timetables for a department
   */
  async deleteAllTimetables(
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<void> {
    validateDepartmentAccess(userAccess, departmentId);

    // Delete all timetables
    await this.timetableRepository.delete({ departmentId });

    // Delete all history
    await this.timetableHistoryRepository.delete({ departmentId });

    // Delete S3 files
    if (this.storageService.isConfigured()) {
      try {
        await this.storageService.deleteTimetableFiles(departmentId);
      } catch (error) {
        this.logger.warn('Failed to delete S3 files', error);
      }
    }

    // Update department
    await this.departmentRepository
      .createQueryBuilder()
      .update(Department)
      .set({
        lastTimetableUpdate: () => 'NULL',
        currentTimetableHistoryId: () => 'NULL',
        currentTimetableUpdatedAt: () => 'NULL',
      })
      .where('id = :departmentId', { departmentId })
      .execute();

    this.logger.log(`Deleted all timetables for department: ${departmentId}`);
  }

  /**
   * Generate preview from file
   */
  generatePreview(fileBuffer: Buffer, dividers?: number[]): TimetablePreview {
    try {
      // Convert Excel to CSV
      const csvData = this.timetableParser.excelToCsv(fileBuffer);

      // Auto-detect dividers if not provided
      let effectiveDividers = dividers;
      if (!effectiveDividers || effectiveDividers.length === 0) {
        effectiveDividers = this.timetableParser.autoDetectDividers(csvData);
      }

      // Parse timetable
      const parsed = this.timetableParser.parseTimetableFromCSV(
        csvData,
        effectiveDividers,
      );

      // Extract metadata
      const metadata =
        this.timetableParser.extractMetadataFromExcel(fileBuffer);

      // Generate preview
      const preview = this.timetableParser.generatePreview(parsed);

      // Identify skipped classes
      const skippedClasses = preview.entries
        .filter(
          (entry) =>
            !entry.day ||
            !entry.room ||
            !entry.time ||
            !entry.subject ||
            !entry.teacher,
        )
        .map((entry) => ({
          classCode: entry.course
            ? `${entry.course}${entry.semester || ''}${entry.section || ''}`
            : '',
          subject: entry.subject || '',
          teacher: entry.teacher || '',
          reason: this.getSkippedReason(entry),
        }));

      // Filter valid entries
      const validEntries = preview.entries.filter(
        (entry) =>
          entry.day &&
          entry.room &&
          entry.time &&
          entry.subject &&
          entry.teacher,
      );

      return {
        entries: validEntries,
        metadata,
        totalClasses: validEntries.length,
        skippedClasses,
      };
    } catch (error) {
      this.logger.error('Failed to generate preview', error);
      throw new BadRequestException(
        `Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get timetable history for a department
   */
  async getTimetableHistory(
    departmentId: string,
    userAccess: UserAccess,
  ): Promise<TimetableHistory[]> {
    validateDepartmentAccess(userAccess, departmentId);

    return this.timetableHistoryRepository.find({
      where: { departmentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get timetable by ID
   */
  async getTimetableById(id: string): Promise<Timetable | null> {
    return this.timetableRepository.findOne({ where: { id } });
  }

  /**
   * Delete timetable
   */
  async deleteTimetable(id: string, userAccess: UserAccess): Promise<void> {
    const timetable = await this.timetableRepository.findOne({
      where: { id },
    });

    if (!timetable) {
      throw new NotFoundException('Timetable not found');
    }

    validateDepartmentAccess(userAccess, timetable.departmentId);

    // Delete S3 files
    if (this.storageService.isConfigured()) {
      try {
        await this.storageService.deleteTimetableFiles(
          timetable.departmentId,
          id,
        );
      } catch (error) {
        this.logger.warn('Failed to delete S3 files', error);
      }
    }

    await this.timetableRepository.remove(timetable);
    this.logger.log(`Timetable deleted: ${id}`);
  }

  /**
   * Create timetable history entry
   */
  async createTimetableHistory(
    departmentId: string,
    fileName: string,
    uploadedBy: string,
    uploadedByName: string,
    userAccess: UserAccess,
  ): Promise<string> {
    validateDepartmentAccess(userAccess, departmentId);

    const history = this.timetableHistoryRepository.create({
      departmentId,
      fileName,
      uploadedBy,
      uploadedByName,
      status: 'processing',
      processingSteps: [],
      anomalies: [],
      clashes: {},
    });

    const saved = await this.timetableHistoryRepository.save(history);
    this.logger.log(`Timetable history created: ${saved.id}`);

    return saved.id;
  }

  /**
   * Update timetable history
   */
  async updateTimetableHistory(
    id: string,
    updates: Partial<TimetableHistory>,
  ): Promise<void> {
    await this.timetableHistoryRepository.update(id, updates);
  }

  /**
   * Get skipped reason for an entry
   */
  private getSkippedReason(entry: TimetableEntry): string {
    const missing: string[] = [];
    if (!entry.day) missing.push('day');
    if (!entry.room) missing.push('room');
    if (!entry.time) missing.push('time');
    if (!entry.subject) missing.push('subject');
    if (!entry.teacher) missing.push('teacher');
    return `Missing: ${missing.join(', ')}`;
  }

  /**
   * Detect clashes in timetable entries
   */
  private detectClashes(entries: TimetableEntry[]): {
    classes?: Array<any>;
    teachers?: Array<any>;
  } {
    const classClashes: Array<any> = [];
    const teacherClashes: Array<any> = [];

    // Group by class code and time
    const classTimeMap = new Map<string, TimetableEntry[]>();
    entries.forEach((entry) => {
      if (entry.course && entry.semester && entry.section) {
        const classKey = `${entry.course}_${entry.semester}_${entry.section}_${entry.day}_${entry.time}`;
        if (!classTimeMap.has(classKey)) {
          classTimeMap.set(classKey, []);
        }
        classTimeMap.get(classKey)!.push(entry);
      }
    });

    // Find class clashes
    classTimeMap.forEach((entries, key) => {
      if (entries.length > 1) {
        const parts = key.split('_');
        classClashes.push({
          classCode: `${parts[0]}_${parts[1]}_${parts[2]}`,
          day: parts[3],
          startTime: parts[4],
          entries: entries.map((e) => ({
            day: e.day,
            subject: e.subject,
            teacher: e.teacher,
            room: e.room,
            timeSlot: e.time,
          })),
        });
      }
    });

    // Group by teacher and time
    const teacherTimeMap = new Map<string, TimetableEntry[]>();
    entries.forEach((entry) => {
      if (entry.teacher) {
        const teacherKey = `${entry.teacher}_${entry.day}_${entry.time}`;
        if (!teacherTimeMap.has(teacherKey)) {
          teacherTimeMap.set(teacherKey, []);
        }
        teacherTimeMap.get(teacherKey)!.push(entry);
      }
    });

    // Find teacher clashes
    teacherTimeMap.forEach((entries, key) => {
      if (entries.length > 1) {
        const parts = key.split('_');
        teacherClashes.push({
          teacher: parts[0],
          day: parts[1],
          startTime: parts[2],
          entries: entries.map((e) => ({
            day: e.day,
            subject: e.subject,
            classCode: e.course
              ? `${e.course}${e.semester || ''}${e.section || ''}`
              : '',
            room: e.room,
            timeSlot: e.time,
          })),
        });
      }
    });

    return {
      classes: classClashes,
      teachers: teacherClashes,
    };
  }
}
