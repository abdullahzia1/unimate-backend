import { Injectable, Logger } from '@nestjs/common';
import { ParsedTimetable } from '../interfaces/timetable.interface';

/**
 * Day section information
 */
interface DaySection {
  dayName: string;
  startRow: number;
  headerRow: number; // Row with time slots
  dataRows: number[]; // Rows with class data
  endRow: number;
}

/**
 * Cell data structure
 */
interface CellData {
  classCode: string;
  course: string;
  semester: string;
  section: string;
  subject: string;
  teacher: string;
  explicitTime?: string;
}

@Injectable()
export class RuleBasedParserService {
  private readonly logger = new Logger(RuleBasedParserService.name);
  private readonly DAY_LABELS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  private readonly COURSE_PREFIXES = [
    'BSCS',
    'BSIT',
    'BSAI',
    'BSCySec',
    'BSBioInformatics',
    'BSDS',
    'BSRS&GIS',
    'BSSE',
    'BS',
    'BSAIM',
  ];

  /**
   * Parse timetable from CSV rows using rule-based logic
   */
  parseTimetableFromCSV(
    csvRows: string[][],
    dividers: number[] = [],
  ): ParsedTimetable {
    this.logger.log(
      `Starting rule-based parsing with ${csvRows.length} rows, ${dividers.length} dividers`,
    );

    const entries: Array<{
      day: string;
      room: string;
      timeSlot: string;
      classCode: string;
      course: string;
      semester: string;
      section: string;
      subject: string;
      teacher: string;
    }> = [];

    // Step 1: Detect day sections
    const daySections = this.detectDaySections(csvRows, dividers);
    this.logger.log(`Detected ${daySections.length} day sections`);

    if (daySections.length === 0) {
      this.logger.warn('No day sections detected');
      return this.buildParsedTimetable(entries);
    }

    // Step 2: Parse each day section
    for (const daySection of daySections) {
      const dayEntries = this.parseDaySection(csvRows, daySection);
      entries.push(...dayEntries);
      this.logger.log(
        `Parsed ${dayEntries.length} entries for ${daySection.dayName}`,
      );
    }

    // Step 3: Build ParsedTimetable structure
    return this.buildParsedTimetable(entries);
  }

  /**
   * Detect day sections in CSV
   */
  private detectDaySections(
    csvRows: string[][],
    dividers: number[],
  ): DaySection[] {
    const sections: DaySection[] = [];

    if (dividers.length > 0) {
      dividers.sort((a, b) => a - b);

      for (let i = 0; i < dividers.length; i++) {
        const startRow = dividers[i];
        const endRow =
          i < dividers.length - 1 ? dividers[i + 1] - 1 : csvRows.length - 1;

        if (startRow < 0 || startRow >= csvRows.length) {
          continue;
        }

        const dayRow = csvRows[startRow];
        if (!dayRow) {
          continue;
        }

        const dayName = this.extractDayName(dayRow);
        if (dayName) {
          const headerRow = this.findTimeSlotHeaderRow(
            csvRows,
            startRow,
            endRow,
          );

          if (headerRow !== -1) {
            const dataRows: number[] = [];
            for (let rowIndex = headerRow + 1; rowIndex <= endRow; rowIndex++) {
              const rowDay = this.extractDayName(csvRows[rowIndex]);
              if (!rowDay) {
                const room = (csvRows[rowIndex]?.[0] || '').trim();
                if (room && room.length > 0) {
                  dataRows.push(rowIndex);
                }
              }
            }

            sections.push({
              dayName,
              startRow,
              headerRow,
              dataRows,
              endRow,
            });
          }
        }
      }
    } else {
      // Auto-detect day sections
      let currentDay: string | null = null;
      let currentStartRow = -1;
      let currentHeaderRow = -1;

      for (let rowIndex = 0; rowIndex < csvRows.length; rowIndex++) {
        const row = csvRows[rowIndex];
        const dayName = this.extractDayName(row);

        if (dayName) {
          if (currentDay && currentHeaderRow !== -1) {
            const dataRows: number[] = [];
            for (let r = currentHeaderRow + 1; r < rowIndex; r++) {
              const rowDay = this.extractDayName(csvRows[r]);
              if (!rowDay) {
                dataRows.push(r);
              }
            }

            if (dataRows.length > 0) {
              sections.push({
                dayName: currentDay,
                startRow: currentStartRow,
                headerRow: currentHeaderRow,
                dataRows,
                endRow: rowIndex - 1,
              });
            }
          }

          currentDay = dayName;
          currentStartRow = rowIndex;
          currentHeaderRow = this.findTimeSlotHeaderRow(
            csvRows,
            rowIndex,
            csvRows.length - 1,
          );
        }
      }

      // Save last day section
      if (currentDay && currentHeaderRow !== -1) {
        const dataRows: number[] = [];
        for (let r = currentHeaderRow + 1; r < csvRows.length; r++) {
          const rowDay = this.extractDayName(csvRows[r]);
          if (!rowDay) {
            dataRows.push(r);
          }
        }

        if (dataRows.length > 0) {
          sections.push({
            dayName: currentDay,
            startRow: currentStartRow,
            headerRow: currentHeaderRow,
            dataRows,
            endRow: csvRows.length - 1,
          });
        }
      }
    }

    return sections;
  }

  /**
   * Extract day name from row
   */
  private extractDayName(row: string[]): string | null {
    if (!row || row.length === 0) {
      return null;
    }

    for (let i = 0; i < Math.min(row.length, 5); i++) {
      const cell = (row[i] || '').trim();
      for (const day of this.DAY_LABELS) {
        if (cell.toLowerCase() === day.toLowerCase()) {
          return day;
        }
        if (cell.toLowerCase().includes(day.toLowerCase())) {
          return day;
        }
      }
    }

    return null;
  }

  /**
   * Find time slot header row
   */
  private findTimeSlotHeaderRow(
    csvRows: string[][],
    startRow: number,
    endRow: number,
  ): number {
    const timeSlotPattern = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/;

    for (
      let rowIndex = startRow + 1;
      rowIndex <= Math.min(startRow + 3, endRow);
      rowIndex++
    ) {
      const row = csvRows[rowIndex];
      if (!row) {
        continue;
      }

      let timeSlotCount = 0;
      for (let colIndex = 1; colIndex < row.length; colIndex++) {
        const cell = (row[colIndex] || '').trim();
        const cleanCell = cell.replace(/\s+/g, '');
        if (timeSlotPattern.test(cleanCell)) {
          timeSlotCount++;
        }
      }

      if (timeSlotCount >= 3) {
        return rowIndex;
      }
    }

    return -1;
  }

  /**
   * Parse a single day section
   */
  private parseDaySection(
    csvRows: string[][],
    daySection: DaySection,
  ): Array<{
    day: string;
    room: string;
    timeSlot: string;
    classCode: string;
    course: string;
    semester: string;
    section: string;
    subject: string;
    teacher: string;
  }> {
    const entries: Array<{
      day: string;
      room: string;
      timeSlot: string;
      classCode: string;
      course: string;
      semester: string;
      section: string;
      subject: string;
      teacher: string;
    }> = [];

    const headerRow = csvRows[daySection.headerRow];
    if (!headerRow || headerRow.length === 0) {
      return entries;
    }

    const timeSlots: string[] = [];
    for (let colIndex = 1; colIndex < headerRow.length; colIndex++) {
      const cell = (headerRow[colIndex] || '').trim();
      const timeSlotPattern = /^\d{1,2}\s*:\s*\d{2}\s*-\s*\d{1,2}\s*:\s*\d{2}$/;
      const cleanCell = cell.replace(/\s+/g, '');
      if (
        timeSlotPattern.test(cell) ||
        /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(cleanCell)
      ) {
        const timeMatch = cleanCell.match(/(\d{1,2}:\d{2}-\d{1,2}:\d{2})/);
        if (timeMatch) {
          timeSlots.push(timeMatch[1]);
        } else {
          timeSlots.push(cleanCell);
        }
      } else {
        timeSlots.push('');
      }
    }

    // Parse data rows
    for (const dataRowIndex of daySection.dataRows) {
      const row = csvRows[dataRowIndex];
      if (!row || row.length === 0) {
        continue;
      }

      const room = (row[0] || '').trim();
      if (!room) {
        continue;
      }

      // Parse each time slot column
      for (
        let colIndex = 1;
        colIndex < row.length && colIndex - 1 < timeSlots.length;
        colIndex++
      ) {
        const timeSlot = timeSlots[colIndex - 1];
        if (!timeSlot) {
          continue;
        }

        const cellContent = (row[colIndex] || '').trim();
        if (!cellContent) {
          continue;
        }

        const parsed = this.parseCellContent(cellContent, timeSlot);
        if (parsed) {
          entries.push({
            day: daySection.dayName,
            room,
            timeSlot,
            classCode: parsed.classCode,
            course: parsed.course,
            semester: parsed.semester,
            section: parsed.section,
            subject: parsed.subject,
            teacher: parsed.teacher,
          });
        }
      }
    }

    return entries;
  }

  /**
   * Parse cell content to extract class information
   */
  private parseCellContent(
    cell: string,
    _defaultTimeSlot: string,
  ): CellData | null {
    if (!cell || cell.trim().length === 0) {
      return null;
    }

    // Split by newlines
    const lines = cell
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return null;
    }

    // First line: class code (e.g., "BSCS7EB")
    const classCode = lines[0] || '';
    const { course, semester, section } = this.parseClassCode(classCode);

    // Second line: subject
    const subject = lines[1] || '';

    // Third line: teacher (may include time)
    let teacher = lines[2] || '';
    // Remove time references like "(8:30-10:30)"
    teacher = teacher
      .replace(/\s*\(\d{1,2}:\d{2}-\d{1,2}:\d{2}\)\s*/g, '')
      .trim();

    if (!classCode || !subject || !teacher) {
      return null;
    }

    return {
      classCode,
      course,
      semester,
      section,
      subject,
      teacher,
    };
  }

  /**
   * Parse class code to extract course, semester, section
   */
  private parseClassCode(classCode: string): {
    course: string;
    semester: string;
    section: string;
  } {
    let course = '';
    let semester = '';
    let section = '';

    // Find course prefix
    for (const prefix of this.COURSE_PREFIXES) {
      if (classCode.toUpperCase().startsWith(prefix.toUpperCase())) {
        course = prefix;
        const remaining = classCode.substring(prefix.length);

        // Extract semester (first digit or digits)
        const semesterMatch = remaining.match(/^(\d+)/);
        if (semesterMatch) {
          semester = semesterMatch[1];
          section = remaining.substring(semesterMatch[1].length);
        } else {
          section = remaining;
        }
        break;
      }
    }

    if (!course) {
      // Default: use first few characters as course
      course = classCode.substring(0, 4);
      section = classCode.substring(4);
    }

    return { course, semester, section };
  }

  /**
   * Build ParsedTimetable structure from entries
   */
  private buildParsedTimetable(
    entries: Array<{
      day: string;
      room: string;
      timeSlot: string;
      classCode: string;
      course: string;
      semester: string;
      section: string;
      subject: string;
      teacher: string;
    }>,
  ): ParsedTimetable {
    const courses = new Set<string>();
    const semesters = new Set<string>();
    const sections = new Set<string>();
    const teachers = new Set<string>();

    entries.forEach((entry) => {
      if (entry.course) {
        courses.add(entry.course);
      }
      if (entry.semester) {
        semesters.add(entry.semester);
      }
      if (entry.section) {
        sections.add(entry.section);
      }
      if (entry.teacher) {
        teachers.add(entry.teacher);
      }
    });

    return {
      courses: Array.from(courses).sort(),
      semesters: Array.from(semesters).sort(),
      sections: Array.from(sections).sort(),
      teachers: Array.from(teachers).sort(),
      classes: entries.map((entry) => ({
        classCode: entry.classCode,
        course: entry.course,
        semester: entry.semester,
        section: entry.section,
        subject: entry.subject,
        teacher: entry.teacher,
        room: entry.room,
        day: entry.day,
        timeSlot: entry.timeSlot,
      })),
    };
  }
}
