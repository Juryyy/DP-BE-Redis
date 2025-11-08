/**
 * Validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service';
import { logger } from '../utils/logger';

/**
 * Validate that session exists and is active
 */
export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId;

    if (!sessionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Session ID is required',
      });
      return;
    }

    // Check if session exists
    const session = await SessionService.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Session not found or expired',
      });
      return;
    }

    // Attach session to request for use in controllers
    (req as any).session = session;

    next();
  } catch (error) {
    logger.error('Session validation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate session',
    });
  }
};

/**
 * Validate file upload
 */
export const validateFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.files || (req.files as any[]).length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'No files uploaded',
    });
    return;
  }

  next();
};

/**
 * Validate request body fields
 */
export const validateRequiredFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter(field => !req.body[field]);

    if (missing.length > 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }

    next();
  };
};
