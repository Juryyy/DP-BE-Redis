import { v4 as uuidv4 } from 'uuid';
import { redisClient, REDIS_KEYS } from '../config/redis';
import prisma from '../config/database';
import { ConversationType, ConversationRole } from '@prisma/client';
import { logger } from '../utils/logger';
import { ChatMessage, ConversationMessage, ConversationThread } from '../types';

// Re-export for backward compatibility
export { ConversationMessage, ConversationThread };

export class ConversationService {
  /**
   * Add a message to the conversation (Redis + DB hybrid approach)
   */
  static async addMessage(
    sessionId: string,
    role: ConversationRole,
    content: string,
    type: ConversationType = ConversationType.GENERAL,
    context?: any,
    parentId?: string
  ): Promise<ConversationMessage> {
    const messageId = uuidv4();
    const now = new Date();

    // Save to database
    const message = await prisma.conversation.create({
      data: {
        id: messageId,
        sessionId,
        type,
        role,
        content,
        context,
        parentId,
        createdAt: now,
      },
    });

    // Save to Redis for active conversation (faster access)
    const conversationKey = REDIS_KEYS.SESSION_CONVERSATIONS(sessionId);
    await redisClient.rpush(conversationKey, JSON.stringify(message));

    // Set expiration on Redis key
    const ttl = parseInt(process.env.CONVERSATION_TTL_SECONDS || '86400');
    await redisClient.expire(conversationKey, ttl);

    logger.info(`Added ${role} message to session ${sessionId}`);

    return message;
  }

  /**
   * Get conversation history for a session
   */
  static async getConversationHistory(
    sessionId: string,
    limit?: number
  ): Promise<ConversationMessage[]> {
    try {
      // Try Redis first (faster)
      const conversationKey = REDIS_KEYS.SESSION_CONVERSATIONS(sessionId);
      const cachedMessages = await redisClient.lrange(conversationKey, 0, -1);

      if (cachedMessages.length > 0) {
        const messages = cachedMessages.map((msg) => JSON.parse(msg));
        return limit ? messages.slice(-limit) : messages;
      }

      // Fallback to database
      const messages = await prisma.conversation.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      // Refresh Redis cache
      if (messages.length > 0) {
        const pipeline = redisClient.pipeline();
        messages.forEach((msg) => {
          pipeline.rpush(conversationKey, JSON.stringify(msg));
        });
        pipeline.expire(conversationKey, parseInt(process.env.CONVERSATION_TTL_SECONDS || '86400'));
        await pipeline.exec();
      }

      return messages;
    } catch (error) {
      logger.error('Error getting conversation history:', error);
      throw error;
    }
  }

  /**
   * Get conversation thread (parent and children)
   */
  static async getConversationThread(messageId: string): Promise<ConversationThread> {
    try {
      // Get the message and its children
      const message = await prisma.conversation.findUnique({
        where: { id: messageId },
        include: {
          children: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }

      // Get parent messages if any
      const parents: any[] = [];
      let currentParentId = message.parentId;

      while (currentParentId) {
        const parent = await prisma.conversation.findUnique({
          where: { id: currentParentId },
        });

        if (parent) {
          parents.unshift(parent);
          currentParentId = parent.parentId;
        } else {
          break;
        }
      }

      const allMessages = [...parents, message, ...message.children];

      return {
        messages: allMessages,
        context: message.context,
      };
    } catch (error) {
      logger.error('Error getting conversation thread:', error);
      throw error;
    }
  }

  /**
   * Convert conversation to ChatMessage format for LLM
   */
  static toChatMessages(conversation: ConversationMessage[]): ChatMessage[] {
    return conversation.map((msg) => ({
      role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  /**
   * Create a clarification conversation
   */
  static async createClarification(
    sessionId: string,
    aiQuestion: string,
    context?: any
  ): Promise<ConversationMessage> {
    return await this.addMessage(
      sessionId,
      ConversationRole.ASSISTANT,
      aiQuestion,
      ConversationType.CLARIFICATION,
      context
    );
  }

  /**
   * Respond to a clarification
   */
  static async respondToClarification(
    sessionId: string,
    clarificationId: string,
    userResponse: string
  ): Promise<ConversationMessage> {
    return await this.addMessage(
      sessionId,
      ConversationRole.USER,
      userResponse,
      ConversationType.CLARIFICATION,
      undefined,
      clarificationId
    );
  }

  /**
   * Get pending clarifications (unanswered questions)
   */
  static async getPendingClarifications(sessionId: string): Promise<ConversationMessage[]> {
    try {
      // Get all clarification messages
      const clarifications = await prisma.conversation.findMany({
        where: {
          sessionId,
          type: ConversationType.CLARIFICATION,
          role: ConversationRole.ASSISTANT,
        },
        include: {
          children: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Filter out those that have been answered
      return clarifications.filter((c) => c.children.length === 0);
    } catch (error) {
      logger.error('Error getting pending clarifications:', error);
      throw error;
    }
  }

  /**
   * Mark clarifications as resolved
   */
  static async markClarificationsResolved(sessionId: string, messageIds: string[]): Promise<void> {
    try {
      // Add a system message to mark resolution
      for (const messageId of messageIds) {
        await this.addMessage(
          sessionId,
          ConversationRole.SYSTEM,
          'Clarification resolved',
          ConversationType.CLARIFICATION,
          { resolved: true },
          messageId
        );
      }

      logger.info(`Marked ${messageIds.length} clarifications as resolved`);
    } catch (error) {
      logger.error('Error marking clarifications as resolved:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history from Redis (persist to DB only)
   */
  static async persistAndClearRedis(sessionId: string): Promise<void> {
    try {
      // Get messages from Redis
      const conversationKey = REDIS_KEYS.SESSION_CONVERSATIONS(sessionId);
      const redisMessages = await redisClient.lrange(conversationKey, 0, -1);

      // Ensure all messages are in database
      for (const msgStr of redisMessages) {
        const msg = JSON.parse(msgStr);

        // Check if already exists
        const exists = await prisma.conversation.findUnique({
          where: { id: msg.id },
        });

        if (!exists) {
          await prisma.conversation.create({
            data: msg,
          });
        }
      }

      // Clear from Redis
      await redisClient.del(conversationKey);

      logger.info(`Persisted and cleared Redis conversation for session ${sessionId}`);
    } catch (error) {
      logger.error('Error persisting conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation summary (for display purposes)
   */
  static async getConversationSummary(sessionId: string): Promise<{
    totalMessages: number;
    clarificationCount: number;
    lastMessageAt: Date | null;
  }> {
    try {
      const [total, clarifications, lastMessage] = await Promise.all([
        prisma.conversation.count({ where: { sessionId } }),
        prisma.conversation.count({
          where: {
            sessionId,
            type: ConversationType.CLARIFICATION,
            role: ConversationRole.ASSISTANT,
          },
        }),
        prisma.conversation.findFirst({
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        totalMessages: total,
        clarificationCount: clarifications,
        lastMessageAt: lastMessage?.createdAt || null,
      };
    } catch (error) {
      logger.error('Error getting conversation summary:', error);
      throw error;
    }
  }
}
