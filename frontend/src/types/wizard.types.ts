/**
 * Wizard and processing types
 */

export type ProcessingMode = 'standard' | 'high_precision' | 'quick_draft';

export type OutputFormat = 'rich_text' | 'pdf' | 'plain_text';

export type TargetType = 'FILE_SPECIFIC' | 'LINE_SPECIFIC' | 'SECTION_SPECIFIC' | 'GLOBAL';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
}

export interface AdditionalSettings {
  includeSourceReferences: boolean;
  generateVisualizations: boolean;
  enableFollowUpQuestions: boolean;
}

export interface ProcessingSummary {
  files: string;
  task: string;
  mode: string;
  format: string;
  model: string;
}

export interface PromptRequest {
  sessionId: string;
  prompts: Array<{
    content: string;
    priority: number;
    targetType: TargetType;
    targetFileId?: string;
    targetSection?: string;
    targetLines?: {
      start: number;
      end: number;
    };
  }>;
}

export interface PromptResponse {
  sessionId: string;
  prompts: Array<{
    id: string;
    content: string;
    priority: number;
    targetType: TargetType;
    executionOrder: number;
  }>;
  estimatedTime: number;
  status: string;
}

export interface ProcessingResult {
  id: string;
  version: number;
  content: string;
  format: string;
  status: 'DRAFT' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'MODIFIED';
  metadata?: {
    promptCount: number;
    generatedAt: string;
  };
  createdAt: string;
}

export interface SessionStatus {
  sessionId: string;
  status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  progress: number;
  prompts: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  hasClarifications: boolean;
  clarificationCount: number;
  hasResult: boolean;
  result: ProcessingResult | null;
}

/**
 * Multi-model execution types
 */
export interface MultiModelResult {
  modelName: string;
  provider: string;
  duration: number; // milliseconds
  result: string;
  status: 'completed' | 'failed';
  error?: string;
  tokensUsed?: number;
  timestamp: string;
}

export interface MultiModelResponse {
  results: MultiModelResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
  combinedResult?: string;
  summary?: {
    totalDuration: number;
    successCount: number;
    failureCount: number;
    totalModels: number;
  };
}
