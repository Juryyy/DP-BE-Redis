import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';
import MarkdownIt from 'markdown-it';
import { markdownTable } from 'markdown-table';

const md = new MarkdownIt();

export interface ParsedDocument {
  text: string;
  metadata: DocumentMetadata;
  sections: DocumentSection[];
  tables: DocumentTable[];
  structure: any;
}

export interface DocumentMetadata {
  filename: string;
  mimeType: string;
  pageCount?: number;
  wordCount: number;
  characterCount: number;
  language?: string;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
}

export interface DocumentSection {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}

export interface DocumentTable {
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
  markdown: string;
}

export class DocumentParserService {
  /**
   * Parse document based on file type
   */
  static async parseDocument(filePath: string, filename: string, mimeType: string): Promise<ParsedDocument> {
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

    // Extract metadata
    const metadata: DocumentMetadata = {
      filename,
      mimeType: 'application/pdf',
      pageCount: pdfData.numpages,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      language: 'cs', // Default to Czech
      author: pdfData.info?.Author,
      createdDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined,
      modifiedDate: pdfData.info?.ModDate ? new Date(pdfData.info.ModDate) : undefined,
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

    // Convert to markdown to preserve structure
    const result = await mammoth.convertToMarkdown({ buffer });
    const markdown = result.value;
    const lines = markdown.split('\n');

    // Parse markdown to detect sections
    const sections = this.detectSectionsFromMarkdown(lines);

    // Extract plain text
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const plainText = htmlResult.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const metadata: DocumentMetadata = {
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      wordCount: plainText.split(/\s+/).length,
      characterCount: plainText.length,
      language: 'cs',
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
        const rows = jsonData.slice(1).map((row: any[]) =>
          row.map((cell: any) => String(cell ?? ''))
        );

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
      language: 'cs',
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
      /^([A-Z][A-Z0-9\s]{5,})$/,  // ALL CAPS headings
      /^(\d+\.\s+.+)$/,            // Numbered headings
      /^([A-Z].{10,}):$/,          // Headings ending with colon
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (let level = 0; level < headingPatterns.length; level++) {
        if (headingPatterns[level].test(line)) {
          // Find end of section
          let endLine = i + 1;
          for (let j = i + 1; j < lines.length; j++) {
            if (headingPatterns.some(pattern => pattern.test(lines[j].trim()))) {
              endLine = j - 1;
              break;
            }
            endLine = j;
          }

          const content = lines.slice(i + 1, endLine + 1).join('\n').trim();

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

        const content = lines.slice(i + 1, endLine + 1).join('\n').trim();

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
    const rows = lines.map(line =>
      line.split(/\t|\s{3,}/).map(cell => cell.trim()).filter(cell => cell.length > 0)
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
      line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);

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
