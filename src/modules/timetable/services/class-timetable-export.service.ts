import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { TimetableEntry } from '../interfaces/timetable.interface';

@Injectable()
export class ClassTimetableExportService {
  private readonly logger = new Logger(ClassTimetableExportService.name);

  /**
   * Generate Excel file from timetable entries
   */
  generateExcel(entries: TimetableEntry[]): Buffer {
    try {
      const workbook = XLSX.utils.book_new();

      // Group entries by day
      const entriesByDay: Record<string, TimetableEntry[]> = {};
      entries.forEach((entry) => {
        if (!entriesByDay[entry.day]) {
          entriesByDay[entry.day] = [];
        }
        entriesByDay[entry.day].push(entry);
      });

      // Create a sheet for each day
      Object.keys(entriesByDay).forEach((day) => {
        const dayEntries = entriesByDay[day];
        const worksheetData = this.prepareWorksheetData(dayEntries);
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, day);
      });

      // If no days, create a single sheet with all entries
      if (Object.keys(entriesByDay).length === 0) {
        const worksheetData = this.prepareWorksheetData(entries);
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');
      }

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      }) as ArrayBuffer;
      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error('Failed to generate Excel file', error);
      throw new Error('Failed to generate Excel file');
    }
  }

  /**
   * Generate PDF from timetable entries
   */
  async generatePDF(entries: TimetableEntry[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', reject);

        // Group entries by day
        const entriesByDay: Record<string, TimetableEntry[]> = {};
        entries.forEach((entry) => {
          if (!entriesByDay[entry.day]) {
            entriesByDay[entry.day] = [];
          }
          entriesByDay[entry.day].push(entry);
        });

        // Generate PDF content
        Object.keys(entriesByDay)
          .sort()
          .forEach((day) => {
            doc.fontSize(16).text(day, { underline: true });
            doc.moveDown();

            const dayEntries = entriesByDay[day];
            dayEntries.forEach((entry) => {
              doc.fontSize(10);
              doc.text(`Time: ${entry.time}`, { continued: true });
              doc.text(` | Room: ${entry.room}`, { continued: true });
              doc.text(` | Subject: ${entry.subject}`, { continued: true });
              doc.text(` | Teacher: ${entry.teacher}`);
              if (entry.course) {
                doc.text(
                  `   Course: ${entry.course}${entry.semester ? ` - Semester ${entry.semester}` : ''}${entry.section ? ` - Section ${entry.section}` : ''}`,
                );
              }
              doc.moveDown(0.5);
            });

            doc.moveDown();
          });

        doc.end();
      } catch (error) {
        this.logger.error('Failed to generate PDF file', error);
        reject(new Error('Failed to generate PDF file'));
      }
    });
  }

  /**
   * Prepare worksheet data from entries
   */
  private prepareWorksheetData(entries: TimetableEntry[]): any[][] {
    const headers = [
      'Day',
      'Time',
      'Room',
      'Subject',
      'Teacher',
      'Course',
      'Semester',
      'Section',
    ];

    const rows = [headers];

    entries.forEach((entry) => {
      rows.push([
        entry.day,
        entry.time,
        entry.room,
        entry.subject,
        entry.teacher,
        entry.course || '',
        entry.semester || '',
        entry.section || '',
      ]);
    });

    return rows;
  }

  /**
   * Format preview data for frontend
   */
  formatPreviewData(entries: TimetableEntry[]): {
    entries: TimetableEntry[];
    totalClasses: number;
    byDay: Record<string, number>;
    byRoom: Record<string, number>;
    byTeacher: Record<string, number>;
  } {
    const byDay: Record<string, number> = {};
    const byRoom: Record<string, number> = {};
    const byTeacher: Record<string, number> = {};

    entries.forEach((entry) => {
      byDay[entry.day] = (byDay[entry.day] || 0) + 1;
      byRoom[entry.room] = (byRoom[entry.room] || 0) + 1;
      byTeacher[entry.teacher] = (byTeacher[entry.teacher] || 0) + 1;
    });

    return {
      entries,
      totalClasses: entries.length,
      byDay,
      byRoom,
      byTeacher,
    };
  }
}
