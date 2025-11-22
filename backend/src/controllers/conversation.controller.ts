/**
 * Conversation Controller
 * Handles chat continuation with multi-model support
 */

import { Request, Response } from 'express';
import { ConversationService } from '../services/conversation.service';
import { MultiModelLLMService, ModelConfig } from '../services/multi-model-llm.service';
import { ContextWindowService } from '../services/context-window.service';
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
      logger.info(`Models to query: ${JSON.stringify(models.map((m: any) => `${m.provider}:${m.model}`))}`);

      // Get conversation history for context
      const conversationHistory = await ConversationService.getConversationHistory(sessionId, 50);
      const chatMessages = ConversationService.toChatMessages(conversationHistory);

      logger.info(`Conversation history: ${chatMessages.length} messages`);

      const effectiveSystemPrompt =
        systemPrompt || 'You are a helpful AI assistant analyzing documents.';

      // Check context window and prepare conversation for each model
      const contextWarnings: string[] = [];
      const preparedConversations = new Map<string, any>();

      for (const model of models) {
        const modelKey = `${model.provider}:${model.model}`;
        const prepared = ContextWindowService.prepareConversation(
          model.provider,
          model.model,
          chatMessages,
          effectiveSystemPrompt,
          message
        );

        preparedConversations.set(modelKey, prepared);

        if (prepared.warnings.length > 0) {
          logger.warn(`Context warnings for ${modelKey}:`, prepared.warnings);
          contextWarnings.push(...prepared.warnings.map((w) => `${modelKey}: ${w}`));
        }

        logger.info(
          `${modelKey} context: ${prepared.tokenCount.total} tokens (${prepared.messages.length} messages)`
        );
      }

      // Use the most restrictive conversation history (smallest that fits all models)
      // For simplicity, use the first model's prepared conversation
      const firstModelKey = `${models[0].provider}:${models[0].model}`;
      const preparedConversation = preparedConversations.get(firstModelKey);

      if (preparedConversation?.tokenCount.exceeds) {
        logger.error('Context window exceeded even after truncation');
      }

      // Execute with multiple models using truncated history
      const modelConfigs: ModelConfig[] = models;
      const result = await MultiModelLLMService.executeMultiModel(
        message,
        effectiveSystemPrompt,
        modelConfigs,
        sessionId,
        preparedConversation?.messages || chatMessages // Use truncated if needed
      );

      logger.info(`Multi-model execution complete: ${result.successCount} succeeded, ${result.failureCount} failed`);

      // Log each model result
      result.results.forEach((r, index) => {
        logger.info(`Model ${index + 1} (${r.provider}:${r.modelName}): ${r.status} - ${r.error || 'success'}`);
      });

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
          contextWarnings: contextWarnings.length > 0 ? contextWarnings : undefined,
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
