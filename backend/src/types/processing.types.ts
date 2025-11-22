/**
 * Processing queue and job types
 */

export interface ProcessingJob {
  sessionId: string;
  promptId: string;
  priority: number;
  createdAt: Date;
}

export interface ProcessingResult {
  success: boolean;
  result?: string;
  error?: string;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
  tokensUsed?: number;
}
