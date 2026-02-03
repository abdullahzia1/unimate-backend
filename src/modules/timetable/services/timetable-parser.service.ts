import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  ParsedTimetable,
  ExcelMetadata,
} from '../interfaces/timetable.interface';
import { RuleBasedParserService } from './rule-based-parser.service';

@Injectable()
export class TimetableParserService {
  private readonly logger = new Logger(TimetableParserService.name);

  constructor(private ruleBasedParser: RuleBasedParserService) {}

  /**
   * Convert Excel file to CSV text
   */
  excelToCsv(fileBuffer: Buffer): string {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      let csvData = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        csvData += csv + '\n';
      });

      return csvData.trim();
    } catch (error) {
      this.logger.error('Failed to convert Excel to CSV', error);
      throw new Error('Failed to convert Excel file to CSV');
    }
  }

  /**
   * Extract metadata from Excel
   */
  extractMetadataFromExcel(fileBuffer: Buffer): ExcelMetadata {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const metadata: ExcelMetadata = {
        teachers: {},
        courses: {},
        subjects: {},
      };

      // Try to find metadata sheet or extract from first sheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        return metadata;
      }

      // Convert to JSON to extract structured data
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // Look for metadata patterns in the sheet
      // This is a simplified extraction - can be enhanced based on actual Excel structure
      for (const row of jsonData as any[]) {
        if (Array.isArray(row)) {
          const firstCell = String(row[0] || '').toLowerCase();
          if (
            firstCell.includes('teacher') ||
            firstCell.includes('instructor')
          ) {
            // Extract teacher mappings
          } else if (firstCell.includes('course')) {
            // Extract course mappings
          } else if (firstCell.includes('subject')) {
            // Extract subject mappings
          }
        }
      }

      return metadata;
    } catch (error) {
      this.logger.error('Failed to extract metadata from Excel', error);
      return {
        teachers: {},
        courses: {},
        subjects: {},
      };
    }
  }

  /**
   * Parse timetable from CSV
   */
  parseTimetableFromCSV(csvData: string, dividers?: number[]): ParsedTimetable {
    try {
      // Convert CSV string to rows
      const rows = csvData.split('\n').map((line) => {
        // Simple CSV parsing (handles quoted values)
        const cells: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }

        cells.push(currentCell.trim());
        return cells;
      });

      // Use rule-based parser
      return this.ruleBasedParser.parseTimetableFromCSV(rows, dividers || []);
    } catch (error) {
      this.logger.error('Failed to parse timetable from CSV', error);
      throw new Error('Failed to parse timetable data');
    }
  }

  /**
   * Auto-detect dividers (day boundaries) in CSV
   */
  autoDetectDividers(csvData: string): number[] {
    try {
      const rows = csvData.split('\n');
      const dividers: number[] = [];
      const dayLabels = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];

      rows.forEach((row, index) => {
        const lowerRow = row.toLowerCase();
        for (const day of dayLabels) {
          if (lowerRow.includes(day.toLowerCase())) {
            dividers.push(index);
            break;
          }
        }
      });

      return dividers;
    } catch (error) {
      this.logger.error('Failed to auto-detect dividers', error);
      return [];
    }
  }

  /**
   * Generate preview from parsed timetable
   */
  generatePreview(parsed: ParsedTimetable): {
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
    totalClasses: number;
    courses: string[];
    semesters: string[];
    sections: string[];
    teachers: string[];
  } {
    const entries = parsed.classes.map((cls) => ({
      day: cls.day,
      time: cls.timeSlot,
      subject: cls.subject,
      teacher: cls.teacher,
      room: cls.room,
      course: cls.course,
      semester: cls.semester,
      section: cls.section,
    }));

    return {
      entries,
      totalClasses: parsed.classes.length,
      courses: parsed.courses,
      semesters: parsed.semesters,
      sections: parsed.sections,
      teachers: parsed.teachers,
    };
  }
}
