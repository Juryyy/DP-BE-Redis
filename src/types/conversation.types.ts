/**
 * Conversation and messaging types
 */

import { ConversationType, ConversationRole } from '@prisma/client';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  type: ConversationType;
  role: ConversationRole;
  content: string;
  context?: any;
  parentId?: string;
  createdAt: Date;
}

export interface ConversationThread {
  messages: ConversationMessage[];
  context: any;
}
