/**
 * API Types and Interfaces for Document Processing Wizard
 */

// ==================== SESSION ====================

export type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface Session {
  id: string;
  userId?: string;
  status: SessionStatus;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

// ==================== FILE ====================

export interface DocumentSection {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  content?: string;
}

export interface DocumentTable {
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
  markdown?: string;
}

export interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  tokenCount: number;
  sections?: DocumentSection[];
  tables?: DocumentTable[];
}

// ==================== PROMPT ====================

export type TargetType = 'GLOBAL' | 'FILE_SPECIFIC' | 'LINE_SPECIFIC' | 'SECTION_SPECIFIC';

export type PromptStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface LineRange {
  start: number;
  end: number;
}

export interface PromptInput {
  content: string;
  priority: number;
  targetType: TargetType;
  targetFileId?: string;
  targetLines?: LineRange;
  targetSection?: string;
}

export interface Prompt extends PromptInput {
  id: string;
  status: PromptStatus;
  executionOrder?: number;
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
}

// ==================== RESULT ====================

export type ResultStatus = 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'MODIFIED';

export interface Result {
  id: string;
  version: number;
  content: string;
  format: 'markdown';
  status: ResultStatus;
  metadata?: Record<string, unknown>;
  aiProvider?: string;
  modelUsed?: string;
  tokensUsed?: number;
  createdAt: string;
  confirmedAt?: string;
}

export type ConfirmAction = 'CONFIRM' | 'MODIFY' | 'REGENERATE';

// ==================== CLARIFICATION ====================

export type ConversationType = 'CLARIFICATION' | 'MODIFICATION' | 'GENERAL';

export type ConversationRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface Clarification {
  id: string;
  type: ConversationType;
  role: ConversationRole;
  content: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

// ==================== TOKEN ESTIMATION ====================

export interface TokenEstimate {
  total: number;
  estimatedCost?: number;
  recommendations?: string[];
}

export interface ModelCompatibility {
  compatible: boolean;
  maxTokens: number;
  remainingTokens: number;
  percentageUsed: number;
}

// ==================== PROGRESS ====================

export interface Progress {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  skipped?: number;
  percentage: number;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UploadResponse {
  sessionId: string;
  files: FileMetadata[];
  tokenEstimate?: TokenEstimate;
  modelCompatibility?: Record<string, ModelCompatibility>;
  canProcess: boolean;
  expiresAt: string;
}

export interface SubmitPromptsResponse {
  sessionId: string;
  prompts: Prompt[];
  estimatedTime?: number;
  status: string;
}

export interface StatusResponse {
  sessionId: string;
  status: SessionStatus;
  progress: Progress;
  hasClarifications: boolean;
  clarificationCount?: number;
  hasResult: boolean;
  result?: Result;
  createdAt: string;
  expiresAt: string;
}

export interface ClarificationsResponse {
  sessionId: string;
  clarifications: Clarification[];
}

export interface ResultResponse {
  sessionId: string;
  result: Result;
  availableVersions?: number[];
  isLatest?: boolean;
}

export interface ConfirmResultResponse {
  sessionId: string;
  resultId: string;
  status: string;
  message: string;
}

export interface ModifyResultResponse {
  sessionId: string;
  result?: Result;
  diff?: unknown[];
  previousVersion?: number;
  status?: string;
  message?: string;
}

// ==================== API REQUESTS ====================

export interface SubmitPromptsRequest {
  sessionId: string;
  prompts: PromptInput[];
}

export interface ClarificationResponseRequest {
  sessionId: string;
  clarificationId: string;
  response: string;
}

export interface ConfirmResultRequest {
  sessionId: string;
  resultId: string;
  action: ConfirmAction;
}

export interface ModifyResultRequest {
  sessionId: string;
  resultId: string;
  modifications: string | PromptInput[];
}
