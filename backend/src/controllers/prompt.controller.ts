/**
 * Prompt Controller
 * Handles prompt submission and management
 */

import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';
import { ProcessingQueueService } from '../services/processing-queue.service';
import prisma from '../config/database';
import { PromptStatus, TargetType } from '@prisma/client';

export class PromptController {
  /**
   * STEP 2: Submit Prompts
   * POST /api/wizard/prompts
   */
  static async submitPrompts(req: Request, res: Response): Promise<void> {
    const { sessionId, prompts } = req.body;

    const session = await SessionService.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const createdPrompts = [];
    for (const promptData of prompts) {
      const prompt = await prisma.prompt.create({
        data: {
          sessionId,
          content: promptData.content,
          priority: promptData.priority,
          targetType: promptData.targetType as TargetType,
          targetFileId: promptData.targetFileId,
          targetLines: promptData.targetLines,
          targetSection: promptData.targetSection,
          status: PromptStatus.PENDING,
        },
      });

      if (promptData.targetFileId) {
        await prisma.promptFile.create({
          data: {
            promptId: prompt.id,
            fileId: promptData.targetFileId,
          },
        });
      }

      createdPrompts.push(prompt);
    }

    const sortedPrompts = createdPrompts.sort((a, b) => a.priority - b.priority);
    const estimatedTimeSeconds = sortedPrompts.length * 10;

    await ProcessingQueueService.enqueueMultiple(
      sortedPrompts.map((p) => ({
        sessionId,
        promptId: p.id,
        priority: p.priority,
      }))
    );

    res.json({
      success: true,
      data: {
        sessionId,
        prompts: sortedPrompts.map((p) => ({
          id: p.id,
          content: p.content,
          priority: p.priority,
          targetType: p.targetType,
          executionOrder: sortedPrompts.indexOf(p) + 1,
        })),
        estimatedTime: estimatedTimeSeconds,
        status: 'queued',
      },
    });
  }
}
