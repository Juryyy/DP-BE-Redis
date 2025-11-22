import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import { stat } from 'fs/promises';
import { logger } from '../utils/logger';
import MarkdownIt from 'markdown-it';
import { markdownTable } from 'markdown-table';
import { ParsedDocument, DocumentMetadata, DocumentSection, DocumentTable } from '../types';
import { DEFAULT_LANGUAGE } from '../constants';

const md = new MarkdownIt();

export class DocumentParserService {
  /**
   * Sanitize and validate date from PDF metadata
   * Falls back to file system dates if invalid or missing
   */
  private static async sanitizeDate(
    rawDate: string | Date | undefined,
    filePath: string,
    type: 'created' | 'modified'
  ): Promise<Date | undefined> {
    try {
      // Try to parse the provided date first
      if (rawDate) {
        let parsedDate: Date | null = null;

        if (rawDate instanceof Date) {
          parsedDate = rawDate;
        } else if (typeof rawDate === 'string') {
          // Handle PDF date formats (D:YYYYMMDDHHmmSSOHH'mm')
          const pdfDateMatch = rawDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
          if (pdfDateMatch) {
            const [, year, month, day, hour = '00', minute = '00', second = '00'] = pdfDateMatch;
            parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
          } else {
            // Try standard date parsing
            parsedDate = new Date(rawDate);
          }
        }

        // Validate the parsed date
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          // Check if date is reasonable (not in future, not before 1970)
          const now = new Date();
          const minDate = new Date('1970-01-01');

          if (parsedDate <= now && parsedDate >= minDate) {
            logger.debug(`Valid date parsed: ${parsedDate.toISOString()}`);
            return parsedDate;
          } else {
            logger.warn(`Date out of reasonable range: ${parsedDate.toISOString()}, using fallback`);
          }
        }
      }

      // Fallback to file system metadata
      logger.info(`Using file system ${type} date as fallback for ${filePath}`);
      const fileStats = await stat(filePath);
      const fallbackDate = type === 'created' ? fileStats.birthtime : fileStats.mtime;

      return fallbackDate;
    } catch (error) {
      logger.error(`Error sanitizing date for ${filePath}:`, error);
      // Last resort: use current date
      return new Date();
    }
  }

  /**
   * Extract file system metadata as fallback
   */
  private static async getFileSystemMetadata(
    filePath: string
  ): Promise<{ created: Date; modified: Date; size: number }> {
    const fileStats = await stat(filePath);
    return {
      created: fileStats.birthtime,
      modified: fileStats.mtime,
      size: fileStats.size,
    };
  }

  /**
   * Parse document based on file type
   */
  static async parseDocument(
    filePath: string,
    filename: string,
    mimeType: string
  ): Promise<ParsedDocument> {
    logger.info(`Parsing document: ${filename} (${mimeType})`);

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.parsePDF(filePath, filename);

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.parseDOCX(filePath, filename);

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.parseXLSX(filePath, filename);

        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      logger.error(`Error parsing document ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Parse PDF file with structure preservation
   */
  private static async parsePDF(filePath: string, filename: string): Promise<ParsedDocument> {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);

    const text = pdfData.text;
    const lines = text.split('\n');

    // Detect sections based on headings
    const sections = this.detectSections(lines);

    // Sanitize dates with fallback to file system metadata
    const createdDate = await this.sanitizeDate(pdfData.info?.CreationDate, filePath, 'created');
    const modifiedDate = await this.sanitizeDate(pdfData.info?.ModDate, filePath, 'modified');

    // Get file system metadata for additional validation
    const fsMetadata = await this.getFileSystemMetadata(filePath);

    logger.info(`PDF dates - Created: ${createdDate?.toISOString()}, Modified: ${modifiedDate?.toISOString()}`);
    logger.info(`File system dates - Created: ${fsMetadata.created.toISOString()}, Modified: ${fsMetadata.modified.toISOString()}`);

    // Extract metadata
    const metadata: DocumentMetadata = {
      filename,
      mimeType: 'application/pdf',
      pageCount: pdfData.numpages,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      language: DEFAULT_LANGUAGE, // Default to Czech
      author: pdfData.info?.Author || 'Unknown',
      createdDate,
      modifiedDate,
    };

    // Detect tables (basic implementation)
    const tables = this.detectTables(lines);

    return {
      text,
      metadata,
      sections,
      tables,
      structure: { type: 'pdf', pages: pdfData.numpages },
    };
  }

  /**
   * Parse DOCX file with structure preservation
   */
  private static async parseDOCX(filePath: string, filename: string): Promise<ParsedDocument> {
    const buffer = await fs.readFile(filePath);

    // Convert to HTML first
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;

    // Convert HTML to markdown-like text
    const markdown = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n');

    const lines = markdown.split('\n');

    // Parse markdown to detect sections
    const sections = this.detectSectionsFromMarkdown(lines);

    // Extract plain text
    const plainText = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Get file system metadata for dates
    const fsMetadata = await this.getFileSystemMetadata(filePath);

    const metadata: DocumentMetadata = {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      wordCount: plainText.split(/\s+/).length,
      characterCount: plainText.length,
      language: DEFAULT_LANGUAGE,
      createdDate: fsMetadata.created,
      modifiedDate: fsMetadata.modified,
    };

    // Detect tables
    const tables = this.detectTablesFromMarkdown(lines);

    return {
      text: markdown, // Use markdown to preserve formatting
      metadata,
      sections,
      tables,
      structure: { type: 'docx', format: 'markdown' },
    };
  }

  /**
   * Parse XLSX file with structure preservation
   */
  private static async parseXLSX(filePath: string, filename: string): Promise<ParsedDocument> {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    let fullText = '';
    const tables: DocumentTable[] = [];
    const sections: DocumentSection[] = [];
    let currentLine = 0;

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      // Add sheet name as section
      sections.push({
        title: sheetName,
        level: 1,
        startLine: currentLine,
        endLine: currentLine,
        content: sheetName,
      });

      fullText += `# ${sheetName}\n\n`;
      currentLine += 2;

      // Convert sheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        // Extract headers (first row)
        const headers = jsonData[0].map((h: any) => String(h || ''));
        const rows = jsonData
          .slice(1)
          .map((row: any[]) => row.map((cell: any) => String(cell ?? '')));

        // Create markdown table
        const tableMarkdown = this.createMarkdownTable(headers, rows);

        const startLine = currentLine;
        const tableLines = tableMarkdown.split('\n').length;
        const endLine = startLine + tableLines;

        tables.push({
          startLine,
          endLine,
          headers,
          rows,
          markdown: tableMarkdown,
        });

        fullText += tableMarkdown + '\n\n';
        currentLine = endLine + 2;
      }
    }

    const metadata: DocumentMetadata = {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      wordCount: fullText.split(/\s+/).length,
      characterCount: fullText.length,
      language: DEFAULT_LANGUAGE,
    };

    return {
      text: fullText,
      metadata,
      sections,
      tables,
      structure: {
        type: 'xlsx',
        sheets: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
      },
    };
  }

  /**
   * Detect sections from plain text lines
   */
  private static detectSections(lines: string[]): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const headingPatterns = [
      /^([A-Z][A-Z0-9\s]{5,})$/, // ALL CAPS headings
      /^(\d+\.\s+.+)$/, // Numbered headings
      /^([A-Z].{10,}):$/, // Headings ending with colon
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (let level = 0; level < headingPatterns.length; level++) {
        if (headingPatterns[level].test(line)) {
          // Find end of section
          let endLine = i + 1;
          for (let j = i + 1; j < lines.length; j++) {
            if (headingPatterns.some((pattern) => pattern.test(lines[j].trim()))) {
              endLine = j - 1;
              break;
            }
            endLine = j;
          }

          const content = lines
            .slice(i + 1, endLine + 1)
            .join('\n')
            .trim();

          sections.push({
            title: line,
            level: level + 1,
            startLine: i,
            endLine,
            content,
          });

          break;
        }
      }
    }

    return sections;
  }

  /**
   * Detect sections from markdown
   */
  private static detectSectionsFromMarkdown(lines: string[]): DocumentSection[] {
    const sections: DocumentSection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];

        // Find end of section
        let endLine = i + 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].match(/^#{1,6}\s+/)) {
            endLine = j - 1;
            break;
          }
          endLine = j;
        }

        const content = lines
          .slice(i + 1, endLine + 1)
          .join('\n')
          .trim();

        sections.push({
          title,
          level,
          startLine: i,
          endLine,
          content,
        });
      }
    }

    return sections;
  }

  /**
   * Detect tables from plain text
   */
  private static detectTables(lines: string[]): DocumentTable[] {
    const tables: DocumentTable[] = [];

    // Basic table detection: look for lines with multiple tabs or aligned columns
    let inTable = false;
    let tableStart = 0;
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasMultipleTabs = (line.match(/\t/g) || []).length >= 2;
      const hasAlignedSpaces = /\s{3,}/.test(line) && line.trim().length > 0;

      if (hasMultipleTabs || hasAlignedSpaces) {
        if (!inTable) {
          inTable = true;
          tableStart = i;
          tableLines = [line];
        } else {
          tableLines.push(line);
        }
      } else if (inTable && line.trim().length === 0) {
        // End of table
        if (tableLines.length >= 2) {
          const table = this.parseTableLines(tableLines, tableStart);
          if (table) {
            tables.push(table);
          }
        }
        inTable = false;
        tableLines = [];
      } else if (inTable) {
        inTable = false;
        if (tableLines.length >= 2) {
          const table = this.parseTableLines(tableLines, tableStart);
          if (table) {
            tables.push(table);
          }
        }
        tableLines = [];
      }
    }

    return tables;
  }

  /**
   * Detect tables from markdown
   */
  private static detectTablesFromMarkdown(lines: string[]): DocumentTable[] {
    const tables: DocumentTable[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect markdown table (starts with |)
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [line];
        let j = i + 1;

        // Collect table lines
        while (j < lines.length && lines[j].trim().startsWith('|')) {
          tableLines.push(lines[j]);
          j++;
        }

        if (tableLines.length >= 2) {
          const table = this.parseMarkdownTable(tableLines, i);
          if (table) {
            tables.push(table);
          }
        }

        i = j - 1;
      }
    }

    return tables;
  }

  /**
   * Parse table from plain text lines
   */
  private static parseTableLines(lines: string[], startLine: number): DocumentTable | null {
    if (lines.length < 2) return null;

    // Split by tabs or multiple spaces
    const rows = lines.map((line) =>
      line
        .split(/\t|\s{3,}/)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
    );

    if (rows.length === 0 || rows[0].length === 0) return null;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const markdown = this.createMarkdownTable(headers, dataRows);

    return {
      startLine,
      endLine: startLine + lines.length - 1,
      headers,
      rows: dataRows,
      markdown,
    };
  }

  /**
   * Parse markdown table
   */
  private static parseMarkdownTable(lines: string[], startLine: number): DocumentTable | null {
    if (lines.length < 2) return null;

    const parseRow = (line: string) =>
      line
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

    const headers = parseRow(lines[0]);
    const dataRows = lines.slice(2).map(parseRow); // Skip separator line

    return {
      startLine,
      endLine: startLine + lines.length - 1,
      headers,
      rows: dataRows,
      markdown: lines.join('\n'),
    };
  }

  /**
   * Create markdown table from headers and rows
   */
  private static createMarkdownTable(headers: string[], rows: string[][]): string {
    const tableData = [headers, ...rows];
    return markdownTable(tableData);
  }
}
