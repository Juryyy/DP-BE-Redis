/**
 * Session Controller
 * Handles session and conversation management
 */

import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';
import { ConversationService } from '../services/conversation.service';

export class SessionController {
  /**
   * Get Conversation History
   * GET /api/wizard/conversation/:sessionId
   */
  static async getConversation(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    const conversation = await ConversationService.getConversationHistory(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        messages: conversation,
      },
    });
  }

  /**
   * Get Session Details
   * GET /api/wizard/session/:sessionId
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    const session = await SessionService.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: session,
    });
  }
}
