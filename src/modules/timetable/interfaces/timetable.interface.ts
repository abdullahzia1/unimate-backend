/**
 * Timetable entry
 */
export interface TimetableEntry {
  day: string;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  course?: string;
  semester?: string;
  section?: string;
}

/**
 * Parsed timetable structure
 */
export interface ParsedTimetable {
  courses: string[];
  semesters: string[];
  sections: string[];
  teachers: string[];
  classes: Array<{
    classCode: string;
    course: string;
    semester: string;
    section: string;
    subject: string;
    teacher: string;
    room: string;
    day: string;
    timeSlot: string;
    isMultiSlot?: boolean;
  }>;
}

/**
 * Excel metadata
 */
export interface ExcelMetadata {
  teachers?: Record<string, string>;
  courses?: Record<string, string>;
  subjects?: Record<string, string>;
}

/**
 * Timetable preview data
 */
export interface TimetablePreview {
  entries: TimetableEntry[];
  metadata: ExcelMetadata;
  totalClasses: number;
  skippedClasses: Array<{
    classCode: string;
    subject: string;
    teacher: string;
    reason: string;
  }>;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  historyId: string;
  steps: Array<{
    step: string;
    status: 'success' | 'failed' | 'info';
    details: string;
  }>;
  skippedClasses: Array<{
    classCode: string;
    subject: string;
    teacher: string;
    reason: string;
  }>;
  processedClassesCount: number;
}
