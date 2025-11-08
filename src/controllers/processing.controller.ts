/**
 * Processing Controller
 * Handles processing status and queue management
 */

import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';
import { ConversationService } from '../services/conversation.service';
import prisma from '../config/database';
import { PromptStatus } from '@prisma/client';

export class ProcessingController {
  /**
   * STEP 3: Get Processing Status
   * GET /api/wizard/status/:sessionId
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    const session = await SessionService.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get prompts status
    const prompts = await prisma.prompt.findMany({
      where: { sessionId },
      orderBy: { priority: 'asc' },
    });

    // Get pending clarifications
    const pendingClarifications = await ConversationService.getPendingClarifications(sessionId);

    // Get latest result
    const latestResult = await prisma.result.findFirst({
      where: { sessionId },
      orderBy: { version: 'desc' },
    });

    const completedCount = prompts.filter(p => p.status === PromptStatus.COMPLETED).length;
    const totalCount = prompts.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    res.json({
      success: true,
      data: {
        sessionId,
        status: session.status,
        progress: Math.round(progress),
        prompts: {
          total: totalCount,
          completed: completedCount,
          processing: prompts.filter(p => p.status === PromptStatus.PROCESSING).length,
          pending: prompts.filter(p => p.status === PromptStatus.PENDING).length,
          failed: prompts.filter(p => p.status === PromptStatus.FAILED).length,
        },
        hasClarifications: pendingClarifications.length > 0,
        clarificationCount: pendingClarifications.length,
        hasResult: !!latestResult,
        result: latestResult ? {
          id: latestResult.id,
          version: latestResult.version,
          status: latestResult.status,
          createdAt: latestResult.createdAt,
        } : null,
      },
    });
  }
}
