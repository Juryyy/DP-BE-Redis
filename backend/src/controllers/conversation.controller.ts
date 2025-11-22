/**
 * Conversation Controller
 * Handles chat continuation with multi-model support
 */

import { Request, Response } from 'express';
import { ConversationService } from '../services/conversation.service';
import { MultiModelLLMService, ModelConfig } from '../services/multi-model-llm.service';
import { ConversationRole, ConversationType } from '@prisma/client';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class ConversationController {
  /**
   * Continue conversation with selected models
   * POST /api/wizard/conversation/:sessionId/continue
   */
  static async continueConversation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { message, models, systemPrompt } = req.body;

      if (!message || !message.trim()) {
        res.status(400).json({
          success: false,
          error: 'Message is required',
        });
        return;
      }

      if (!models || !Array.isArray(models) || models.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one model must be selected',
        });
        return;
      }

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      // Add user message to conversation history
      await ConversationService.addMessage(
        sessionId,
        ConversationRole.USER,
        message,
        ConversationType.GENERAL
      );

      logger.info(`User sent message in session ${sessionId} to ${models.length} model(s)`);

      // Get conversation history for context
      const conversationHistory = await ConversationService.getConversationHistory(sessionId, 20);
      const chatMessages = ConversationService.toChatMessages(conversationHistory);

      // Execute with multiple models
      const modelConfigs: ModelConfig[] = models;
      const result = await MultiModelLLMService.executeMultiModel(
        message,
        systemPrompt || 'You are a helpful AI assistant analyzing documents.',
        modelConfigs,
        sessionId,
        chatMessages // Include conversation history
      );

      // Add each model's response to conversation history
      for (const modelResult of result.results) {
        if (modelResult.status === 'completed') {
          await ConversationService.addMessage(
            sessionId,
            ConversationRole.ASSISTANT,
            modelResult.result,
            ConversationType.GENERAL,
            {
              provider: modelResult.provider,
              modelName: modelResult.modelName,
              duration: modelResult.duration,
              tokensUsed: modelResult.tokensUsed,
            }
          );
        }
      }

      res.json({
        success: true,
        data: {
          sessionId,
          userMessage: message,
          responses: result.results.map((r) => ({
            provider: r.provider,
            modelName: r.modelName,
            status: r.status,
            result: r.result,
            error: r.error,
            duration: r.duration,
            tokensUsed: r.tokensUsed,
          })),
          totalDuration: result.totalDuration,
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
      });
    } catch (error) {
      logger.error('Error in conversation continuation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get conversation history
   * GET /api/wizard/conversation/:sessionId
   */
  static async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit } = req.query;

      const conversation = await ConversationService.getConversationHistory(
        sessionId,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: {
          sessionId,
          messages: conversation.map((msg) => ({
            id: msg.id,
            type: msg.type,
            role: msg.role,
            content: msg.content,
            context: msg.context,
            createdAt: msg.createdAt,
          })),
        },
      });
    } catch (error) {
      logger.error('Error getting conversation:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}
