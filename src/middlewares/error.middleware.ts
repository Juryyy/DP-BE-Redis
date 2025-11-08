/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handler
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`Error in ${req.method} ${req.path}:`, error);

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = (error as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'development'
    ? error.message
    : 'Something went wrong';

  res.status(statusCode).json({
    error: error.name || 'Internal Server Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};
