import { redisClient, REDIS_KEYS, redisPubClient, redisSubClient } from '../config/redis';
import prisma from '../config/database';
import { PromptStatus, SessionStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { LLMService, createLLMService, AIProvider } from './llm.service';
import { ConversationService } from './conversation.service';
import { ConversationRole, ConversationType } from '@prisma/client';
import { SessionService } from './session.service';
import { ProcessingJob, ProcessingResult } from '../types';
import { CZECH_SYSTEM_PROMPT, MAX_CONCURRENT_PROCESSING } from '../constants';

// Re-export for backward compatibility
export { ProcessingJob, ProcessingResult };

export class ProcessingQueueService {
  private static isProcessing = false;
  private static processingJobs = new Set<string>();

  static async enqueue(sessionId: string, promptId: string, priority: number): Promise<void> {
    try {
      const job: ProcessingJob = {
        sessionId,
        promptId,
        priority,
        createdAt: new Date(),
      };

      // Lower number = higher priority (Redis sorted set score)
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

      this.startProcessing();
    } catch (error) {
      logger.error('Error enqueueing multiple jobs:', error);
      throw error;
    }
  }

  static async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.info('Processing already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting queue processing');

    try {
      while (true) {
        // Get job with highest priority (lowest score in Redis sorted set)
        const jobs = await redisClient.zrange(REDIS_KEYS.PROCESSING_QUEUE, 0, 0);

        if (jobs.length === 0) {
          logger.info('Queue is empty, stopping processing');
          break;
        }

        const job: ProcessingJob = JSON.parse(jobs[0]);

        if (this.processingJobs.has(job.promptId)) {
          logger.warn(`Job ${job.promptId} is already being processed`);
          continue;
        }

        this.processingJobs.add(job.promptId);

        await redisClient.zrem(REDIS_KEYS.PROCESSING_QUEUE, jobs[0]);

        await this.processJob(job);

        this.processingJobs.delete(job.promptId);

        const activeCount = await SessionService.getActiveSessionCount();
        const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_PROCESSING || String(MAX_CONCURRENT_PROCESSING));

        if (activeCount >= maxConcurrent) {
          logger.warn(`Max concurrent processing limit (${maxConcurrent}) reached, pausing`);
          break;
        }
      }
    } catch (error) {
      logger.error('Error in queue processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private static async processJob(job: ProcessingJob): Promise<void> {
    const { sessionId, promptId } = job;

    try {
      logger.info(`Processing prompt ${promptId} for session ${sessionId}`);

      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.PROCESSING,
          executedAt: new Date(),
        },
      });

      await SessionService.updateSessionStatus(sessionId, SessionStatus.PROCESSING);

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

      const sessionFiles = await prisma.file.findMany({
        where: { sessionId },
      });

      const previousResults = await this.getPreviousResults(sessionId, prompt.priority);

      // Check if this is a GLOBAL prompt with too much content
      if (prompt.targetType === 'GLOBAL') {
        const totalSize = sessionFiles.reduce((sum, f) => sum + (f.extractedText?.length || 0), 0);

        if (totalSize > 100000) {
          logger.warn(`GLOBAL prompt with ${totalSize} characters (${Math.round(totalSize/1000)}KB). Auto-splitting into file-by-file processing.`);
          await this.processGlobalPromptSequentially(sessionId, prompt, sessionFiles, previousResults);
          return;
        }
      }

      const fullPrompt = this.buildPromptWithContext(prompt, sessionFiles, previousResults);

      const conversationHistory = await ConversationService.getConversationHistory(sessionId);

      const llmService = await createLLMService();

      logger.info(`Prompt size: ${fullPrompt.length} characters, System prompt size: ${CZECH_SYSTEM_PROMPT.length} characters`);

      // Warn about large prompts
      if (fullPrompt.length > 100000) {
        logger.warn(`LARGE PROMPT WARNING: ${fullPrompt.length} characters (${Math.round(fullPrompt.length / 1000)}KB). This may cause timeouts or out-of-memory errors. Consider splitting the document into smaller sections.`);
      }

      const startTime = Date.now();
      const response = await llmService.complete(fullPrompt, CZECH_SYSTEM_PROMPT);
      const processingTime = Date.now() - startTime;

      logger.info(`LLM response received: ${response.content.length} characters, tokens: ${response.tokensUsed || 'unknown'}, took ${processingTime}ms`);

      const needsClarification = LLMService.detectUncertainty(response.content);
      const clarificationQuestions = needsClarification
        ? LLMService.extractClarificationQuestions(response.content)
        : [];

      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.COMPLETED,
          completedAt: new Date(),
          result: response.content,
        },
      });

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

      await prisma.prompt.update({
        where: { id: promptId },
        data: {
          status: PromptStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      await SessionService.updateSessionStatus(sessionId, SessionStatus.FAILED);
    }
  }

  /**
   * Process GLOBAL prompt by splitting into file-by-file processing
   */
  private static async processGlobalPromptSequentially(
    sessionId: string,
    prompt: any,
    sessionFiles: any[],
    previousResults: string[]
  ): Promise<void> {
    const llmService = await createLLMService();
    const fileResults: string[] = [];
    let totalTokens = 0;
    const overallStartTime = Date.now();

    logger.info(`Processing ${sessionFiles.length} files sequentially for GLOBAL prompt`);

    for (let i = 0; i < sessionFiles.length; i++) {
      const file = sessionFiles[i];

      if (!file.extractedText) {
        logger.warn(`Skipping file ${file.originalName} - no extracted text`);
        continue;
      }

      logger.info(`Processing file ${i + 1}/${sessionFiles.length}: ${file.originalName} (${file.extractedText.length} characters)`);

      let filePrompt = '';

      // Add previous file results as context
      if (fileResults.length > 0) {
        filePrompt += '# Výsledky z předchozích souborů:\n\n';
        fileResults.forEach((result, idx) => {
          const prevFile = sessionFiles[idx];
          filePrompt += `## ${prevFile.originalName}:\n${result}\n\n`;
        });
        filePrompt += '---\n\n';
      }

      filePrompt += `# Obsah souboru: ${file.originalName}\n\n`;
      filePrompt += file.extractedText + '\n\n';
      filePrompt += `# Úkol:\n\n${prompt.content}\n`;

      const startTime = Date.now();
      const response = await llmService.complete(filePrompt, CZECH_SYSTEM_PROMPT);
      const processingTime = Date.now() - startTime;

      logger.info(`File ${i + 1}/${sessionFiles.length} processed: ${response.content.length} characters, took ${processingTime}ms`);

      fileResults.push(response.content);
      totalTokens += response.tokensUsed || 0;
    }

    // Combine all results
    const combinedResult = fileResults.map((result, idx) => {
      const file = sessionFiles[idx];
      return `## ${file.originalName}\n\n${result}`;
    }).join('\n\n---\n\n');

    const totalProcessingTime = Date.now() - overallStartTime;

    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        status: PromptStatus.COMPLETED,
        completedAt: new Date(),
        result: combinedResult,
      },
    });

    await ConversationService.addMessage(
      sessionId,
      ConversationRole.ASSISTANT,
      combinedResult,
      ConversationType.GENERAL,
      {
        promptId: prompt.id,
        tokensUsed: totalTokens,
        processingTime: totalProcessingTime,
        fileCount: sessionFiles.length,
      }
    );

    logger.info(`Successfully processed GLOBAL prompt with ${sessionFiles.length} files in ${totalProcessingTime}ms (${Math.round(totalProcessingTime/1000)}s)`);
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

  private static buildPromptWithContext(
    prompt: any,
    sessionFiles: any[],
    previousResults: string[]
  ): string {
    let fullPrompt = '';

    if (previousResults.length > 0) {
      fullPrompt += '# Kontext z předchozích úkolů:\n\n';
      previousResults.forEach((result, index) => {
        fullPrompt += `## Výsledek úkolu ${index + 1}:\n${result}\n\n`;
      });
      fullPrompt += '---\n\n';
    }

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
      fullPrompt += '# Všechny soubory:\n\n';
      sessionFiles.forEach((file) => {
        if (file.extractedText) {
          fullPrompt += `## ${file.originalName}\n\n`;
          fullPrompt += file.extractedText + '\n\n';
        }
      });
    }

    fullPrompt += `# Úkol:\n\n${prompt.content}\n`;

    return fullPrompt;
  }

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
