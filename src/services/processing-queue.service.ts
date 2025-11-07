import { redisClient, REDIS_KEYS, redisPubClient, redisSubClient } from '../config/redis';
import prisma from '../config/database';
import { PromptStatus, SessionStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { LLMService, createLLMService, AIProvider } from './llm.service';
import { ConversationService } from './conversation.service';
import { ConversationRole, ConversationType } from '@prisma/client';
import { SessionService } from './session.service';

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

export class ProcessingQueueService {
  private static isProcessing = false;
  private static processingJobs = new Set<string>();

  /**
   * Add a prompt to the processing queue
   */
  static async enqueue(sessionId: string, promptId: string, priority: number): Promise<void> {
    try {
      const job: ProcessingJob = {
        sessionId,
        promptId,
        priority,
        createdAt: new Date(),
      };

      // Add to Redis sorted set (sorted by priority, lower number = higher priority)
      await redisClient.zadd(
        REDIS_KEYS.PROCESSING_QUEUE,
        priority,
        JSON.stringify(job)
      );

      logger.info(`Enqueued prompt ${promptId} with priority ${priority}`);

      // Trigger processing if not already running
      this.startProcessing();
    } catch (error) {
      logger.error('Error enqueueing job:', error);
      throw error;
    }
  }

  /**
   * Enqueue multiple prompts at once
   */
  static async enqueueMultiple(prompts: Array<{ sessionId: string; promptId: string; priority: number }>): Promise<void> {
    try {
      const pipeline = redisClient.pipeline();

      for (const prompt of prompts) {
        const job: ProcessingJob = {
          sessionId: prompt.sessionId,
          promptId: prompt.promptId,
          priority: prompt.priority,
          createdAt: new Date(),
        };

        pipeline.zadd(
          REDIS_KEYS.PROCESSING_QUEUE,
          prompt.priority,
          JSON.stringify(job)
        );
      }

      await pipeline.exec();

      logger.info(`Enqueued ${prompts.length} prompts`);

      // Trigger processing
      this.startProcessing();
    } catch (error) {
      logger.error('Error enqueueing multiple jobs:', error);
      throw error;
    }
  }

  /**
   * Start processing the queue
   */
  static async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.info('Processing already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting queue processing');

    try {
      while (true) {
        // Get the highest priority job (lowest score)
        const jobs = await redisClient.zrange(REDIS_KEYS.PROCESSING_QUEUE, 0, 0);

        if (jobs.length === 0) {
          logger.info('Queue is empty, stopping processing');
          break;
        }

        const job: ProcessingJob = JSON.parse(jobs[0]);

        // Check if already processing this job
        if (this.processingJobs.has(job.promptId)) {
          logger.warn(`Job ${job.promptId} is already being processed`);
          continue;
        }

        // Mark as processing
        this.processingJobs.add(job.promptId);

        // Remove from queue
        await redisClient.zrem(REDIS_KEYS.PROCESSING_QUEUE, jobs[0]);

        // Process the job
        await this.processJob(job);

        // Remove from processing set
        this.processingJobs.delete(job.promptId);

        // Check max concurrent processing limit
        const activeCount = await SessionService.getActiveSessionCount();
        const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PROCESSING || '5');

        if (activeCount >= maxConcurrent) {
          logger.warn('Max concurrent processing limit reached, pausing');
          break;
        }
      }
    } catch (error) {
      logger.error('Error in queue processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private static async processJob(job: ProcessingJob): Promise<void> {
    const { sessionId, promptId } = job;

    try {
      logger.info(`Processing prompt ${promptId} for session ${sessionId}`);

      // Update prompt status
      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.PROCESSING,
          executedAt: new Date(),
        },
      });

      // Update session status
      await SessionService.updateSessionStatus(sessionId, SessionStatus.PROCESSING);

      // Get prompt details
      const prompt = await prisma.prompt.findUnique({
        where: { id: promptId },
        include: {
          files: {
            include: {
              file: true,
            },
          },
        },
      });

      if (!prompt) {
        throw new Error(`Prompt ${promptId} not found`);
      }

      // Get all files for the session
      const sessionFiles = await prisma.file.findMany({
        where: { sessionId },
      });

      // Build context from previous prompts
      const previousResults = await this.getPreviousResults(sessionId, prompt.priority);

      // Build the full prompt with context
      const fullPrompt = this.buildPromptWithContext(prompt, sessionFiles, previousResults);

      // Get conversation history
      const conversationHistory = await ConversationService.getConversationHistory(sessionId);

      // Create LLM service
      const llmService = createLLMService();

      // Add system message for Czech language
      const systemPrompt = `Jsi AI asistent pro zpracování dokumentů. Tvým úkolem je analyzovat a zpracovávat dokumenty v českém jazyce.
Vždy odpovídej v češtině, pokud není výslovně požadováno jinak.
Zachovej strukturu dokumentů, zejména tabulky ve formátu Markdown.
Pokud si nejsi jistý nebo potřebuješ objasnění, jasně to uveď ve své odpovědi.`;

      // Execute prompt
      const startTime = Date.now();
      const response = await llmService.complete(fullPrompt, systemPrompt);
      const processingTime = Date.now() - startTime;

      // Check for uncertainty
      const needsClarification = LLMService.detectUncertainty(response.content);
      const clarificationQuestions = needsClarification
        ? LLMService.extractClarificationQuestions(response.content)
        : [];

      // Save result
      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.COMPLETED,
          completedAt: new Date(),
          result: response.content,
        },
      });

      // Add to conversation
      await ConversationService.addMessage(
        sessionId,
        ConversationRole.ASSISTANT,
        response.content,
        ConversationType.GENERAL,
        {
          promptId,
          tokensUsed: response.tokensUsed,
          processingTime,
        }
      );

      // If needs clarification, create clarification messages
      if (needsClarification && clarificationQuestions.length > 0) {
        for (const question of clarificationQuestions) {
          await ConversationService.createClarification(
            sessionId,
            question,
            { promptId, relatedToResult: response.content }
          );
        }

        logger.info(`Created ${clarificationQuestions.length} clarification questions`);
      }

      logger.info(`Successfully processed prompt ${promptId} in ${processingTime}ms`);
    } catch (error) {
      logger.error(`Error processing prompt ${promptId}:`, error);

      // Update prompt as failed
      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      // Update session status
      await SessionService.updateSessionStatus(sessionId, SessionStatus.FAILED);
    }
  }

  /**
   * Get results from previous prompts (for context accumulation)
   */
  private static async getPreviousResults(sessionId: string, currentPriority: number): Promise<string[]> {
    try {
      const previousPrompts = await prisma.prompt.findMany({
        where: {
          sessionId,
          priority: { lt: currentPriority },
          status: PromptStatus.COMPLETED,
        },
        orderBy: { priority: 'asc' },
        select: { result: true },
      });

      return previousPrompts
        .filter((p) => p.result)
        .map((p) => p.result!);
    } catch (error) {
      logger.error('Error getting previous results:', error);
      return [];
    }
  }

  /**
   * Build prompt with full context
   */
  private static buildPromptWithContext(
    prompt: any,
    sessionFiles: any[],
    previousResults: string[]
  ): string {
    let fullPrompt = '';

    // Add previous results as context
    if (previousResults.length > 0) {
      fullPrompt += '# Kontext z předchozích úkolů:\n\n';
      previousResults.forEach((result, index) => {
        fullPrompt += `## Výsledek úkolu ${index + 1}:\n${result}\n\n`;
      });
      fullPrompt += '---\n\n';
    }

    // Add file content based on target type
    if (prompt.targetType === 'FILE_SPECIFIC' && prompt.targetFileId) {
      const targetFile = sessionFiles.find((f) => f.id === prompt.targetFileId);
      if (targetFile && targetFile.extractedText) {
        fullPrompt += `# Obsah souboru: ${targetFile.originalName}\n\n`;
        fullPrompt += targetFile.extractedText + '\n\n';
      }
    } else if (prompt.targetType === 'LINE_SPECIFIC' && prompt.targetFileId && prompt.targetLines) {
      const targetFile = sessionFiles.find((f) => f.id === prompt.targetFileId);
      if (targetFile && targetFile.extractedText) {
        const lines = targetFile.extractedText.split('\n');
        const { start, end } = prompt.targetLines as { start: number; end: number };
        const relevantLines = lines.slice(start - 1, end);

        fullPrompt += `# Řádky ${start}-${end} ze souboru: ${targetFile.originalName}\n\n`;
        fullPrompt += relevantLines.join('\n') + '\n\n';
      }
    } else if (prompt.targetType === 'SECTION_SPECIFIC' && prompt.targetSection) {
      // Find section in files
      for (const file of sessionFiles) {
        if (file.sections) {
          const sections = Array.isArray(file.sections) ? file.sections : [];
          const targetSection = sections.find(
            (s: any) => s.title.toLowerCase().includes(prompt.targetSection.toLowerCase())
          );

          if (targetSection) {
            fullPrompt += `# Sekce "${targetSection.title}" ze souboru: ${file.originalName}\n\n`;
            fullPrompt += targetSection.content + '\n\n';
            break;
          }
        }
      }
    } else if (prompt.targetType === 'GLOBAL') {
      // Add all files
      fullPrompt += '# Všechny soubory:\n\n';
      sessionFiles.forEach((file) => {
        if (file.extractedText) {
          fullPrompt += `## ${file.originalName}\n\n`;
          fullPrompt += file.extractedText + '\n\n';
        }
      });
    }

    // Add the actual prompt
    fullPrompt += `# Úkol:\n\n${prompt.content}\n`;

    return fullPrompt;
  }

  /**
   * Get queue status
   */
  static async getQueueStatus(): Promise<{
    queueSize: number;
    processing: number;
    jobs: ProcessingJob[];
  }> {
    try {
      const jobs = await redisClient.zrange(REDIS_KEYS.PROCESSING_QUEUE, 0, -1);

      return {
        queueSize: jobs.length,
        processing: this.processingJobs.size,
        jobs: jobs.map((j) => JSON.parse(j)),
      };
    } catch (error) {
      logger.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Clear the queue (for testing/admin purposes)
   */
  static async clearQueue(): Promise<void> {
    try {
      await redisClient.del(REDIS_KEYS.PROCESSING_QUEUE);
      this.processingJobs.clear();
      logger.info('Queue cleared');
    } catch (error) {
      logger.error('Error clearing queue:', error);
      throw error;
    }
  }
}
