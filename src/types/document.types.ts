/**
 * Document parsing and processing types
 */

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
