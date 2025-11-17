/**
 * Session management types
 */

import { SessionStatus } from '@prisma/client';

export interface SessionData {
  id: string;
  userId?: string;
  status: SessionStatus;
  createdAt: Date;
  expiresAt: Date;
  metadata?: any;
}
