/**
 * Clarification Controller
 * Handles AI clarification requests and responses
 */

import { Request, Response } from 'express';
import { ConversationService } from '../services/conversation.service';
import { ProcessingQueueService } from '../services/processing-queue.service';
import prisma from '../config/database';

export class ClarificationController {
  /**
   * STEP 4: Get Clarifications
   * GET /api/wizard/clarifications/:sessionId
   */
  static async getClarifications(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    const clarifications = await ConversationService.getPendingClarifications(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        clarifications: clarifications.map(c => ({
          id: c.id,
          question: c.content,
          context: c.context,
          createdAt: c.createdAt,
        })),
      },
    });
  }

  /**
   * STEP 4: Respond to Clarification
   * POST /api/wizard/clarifications/respond
   */
  static async respondToClarification(req: Request, res: Response): Promise<void> {
    const { sessionId, clarificationId, response } = req.body;

    await ConversationService.respondToClarification(sessionId, clarificationId, response);

    const clarification = await prisma.conversation.findUnique({
      where: { id: clarificationId },
    });

    const context = clarification?.context as any;
    if (context?.promptId) {
      const prompt = await prisma.prompt.findUnique({
        where: { id: context.promptId },
      });

      if (prompt) {
        await ProcessingQueueService.enqueue(sessionId, prompt.id, prompt.priority);
      }
    }

    res.json({
      success: true,
      data: {
        sessionId,
        clarificationId,
        status: 'answered',
      },
    });
  }
}
