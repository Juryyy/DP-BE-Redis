import { v4 as uuidv4 } from 'uuid';
import { redisClient, REDIS_KEYS } from '../config/redis';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { SessionStatus } from '@prisma/client';
import { SessionData } from '../types';

// Re-export for backward compatibility
export { SessionData };

export class SessionService {
  /**
   * Create a new session
   */
  static async createSession(userId?: string, metadata?: any): Promise<SessionData> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parseInt(process.env.SESSION_EXPIRE_SECONDS || '3600') * 1000);

    // Create session in database
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        status: SessionStatus.ACTIVE,
        expiresAt,
        metadata: metadata || {},
      },
    });

    // Store session in Redis for quick access
    const sessionKey = REDIS_KEYS.SESSION(sessionId);
    await redisClient.setex(
      sessionKey,
      parseInt(process.env.SESSION_EXPIRE_SECONDS || '3600'),
      JSON.stringify(session)
    );

    // Add to active sessions set
    await redisClient.sadd(REDIS_KEYS.ACTIVE_SESSIONS, sessionId);

    logger.info(`Session created: ${sessionId}`);
    return session;
  }

  /**
   * Get session by ID (try Redis first, then database)
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      // Try Redis first
      const sessionKey = REDIS_KEYS.SESSION(sessionId);
      const cachedSession = await redisClient.get(sessionKey);

      if (cachedSession) {
        return JSON.parse(cachedSession);
      }

      // Fallback to database
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (session) {
        // Refresh Redis cache
        await redisClient.setex(
          sessionKey,
          parseInt(process.env.SESSION_EXPIRE_SECONDS || '3600'),
          JSON.stringify(session)
        );
      }

      return session;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session status
   */
  static async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    try {
      // Update in database
      const session = await prisma.session.update({
        where: { id: sessionId },
        data: { status, updatedAt: new Date() },
      });

      // Update in Redis
      const sessionKey = REDIS_KEYS.SESSION(sessionId);
      await redisClient.setex(
        sessionKey,
        parseInt(process.env.SESSION_EXPIRE_SECONDS || '3600'),
        JSON.stringify(session)
      );

      logger.info(`Session ${sessionId} status updated to ${status}`);
    } catch (error) {
      logger.error('Error updating session status:', error);
      throw error;
    }
  }

  /**
   * Extend session expiration
   */
  static async extendSession(sessionId: string, additionalSeconds: number = 3600): Promise<void> {
    try {
      const newExpiresAt = new Date(Date.now() + additionalSeconds * 1000);

      // Update in database
      await prisma.session.update({
        where: { id: sessionId },
        data: { expiresAt: newExpiresAt },
      });

      // Update in Redis
      const sessionKey = REDIS_KEYS.SESSION(sessionId);
      await redisClient.expire(sessionKey, additionalSeconds);

      logger.info(`Session ${sessionId} extended by ${additionalSeconds} seconds`);
    } catch (error) {
      logger.error('Error extending session:', error);
      throw error;
    }
  }

  /**
   * Delete session (cleanup)
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      // Remove from Redis
      const sessionKey = REDIS_KEYS.SESSION(sessionId);
      await redisClient.del(sessionKey);
      await redisClient.srem(REDIS_KEYS.ACTIVE_SESSIONS, sessionId);

      // Remove related keys
      await redisClient.del(REDIS_KEYS.SESSION_FILES(sessionId));
      await redisClient.del(REDIS_KEYS.SESSION_PROMPTS(sessionId));
      await redisClient.del(REDIS_KEYS.SESSION_CONVERSATIONS(sessionId));
      await redisClient.del(REDIS_KEYS.SESSION_RESULT(sessionId));

      // Mark as expired in database (don't actually delete for audit trail)
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.EXPIRED },
      });

      logger.info(`Session ${sessionId} deleted`);
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired sessions (should be run periodically)
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();

      // Find expired sessions
      const expiredSessions = await prisma.session.findMany({
        where: {
          expiresAt: { lt: now },
          status: { in: [SessionStatus.ACTIVE, SessionStatus.PROCESSING] },
        },
        select: { id: true },
      });

      for (const session of expiredSessions) {
        await this.deleteSession(session.id);
      }

      logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Get active session count
   */
  static async getActiveSessionCount(): Promise<number> {
    return await redisClient.scard(REDIS_KEYS.ACTIVE_SESSIONS);
  }
}
