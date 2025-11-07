import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Main Redis client
export const redisClient = new Redis(redisConfig);

// Redis client for pub/sub
export const redisPubClient = new Redis(redisConfig);
export const redisSubClient = new Redis(redisConfig);

// Connection event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

// Graceful shutdown
export const closeRedisConnections = async () => {
  try {
    await redisClient.quit();
    await redisPubClient.quit();
    await redisSubClient.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
};

// Redis key prefixes
export const REDIS_KEYS = {
  SESSION: (sessionId: string) => `session:${sessionId}`,
  SESSION_FILES: (sessionId: string) => `session:${sessionId}:files`,
  SESSION_PROMPTS: (sessionId: string) => `session:${sessionId}:prompts`,
  SESSION_CONVERSATIONS: (sessionId: string) => `session:${sessionId}:conversations`,
  SESSION_RESULT: (sessionId: string) => `session:${sessionId}:result`,
  PROCESSING_QUEUE: 'queue:processing',
  ACTIVE_SESSIONS: 'sessions:active',
  FILE_CONTENT: (fileId: string) => `file:${fileId}:content`,
  TOKEN_ESTIMATE: (fileId: string) => `file:${fileId}:tokens`,
} as const;
