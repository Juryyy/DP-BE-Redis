/**
 * File and document types
 */

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url?: string; // URL for accessing the file content
  tokenCount?: number;
  sections?: DocumentSection[];
  tables?: DocumentTable[];
}

export interface DocumentSection {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
}

export interface DocumentTable {
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
}

export interface UploadResponse {
  sessionId: string;
  files: UploadedFile[];
  tokenEstimate?: {
    total: number;
    estimatedCost: number;
    recommendations: string[];
  };
  modelCompatibility?: Record<string, {
    compatible: boolean;
    maxTokens: number;
    remainingTokens: number;
    percentageUsed: number;
  }>;
  canProcess: boolean;
  expiresAt: string;
}

export interface FileUploadEvent {
  sessionId: string;
  files: UploadedFile[];
}
