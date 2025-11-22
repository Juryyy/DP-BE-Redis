/**
 * Context Window Management Service
 * Handles token counting and context window limits for different LLM providers
 */

import { logger } from '../utils/logger';
import { AIProvider } from './llm.service';

// Context window sizes for different models (in tokens)
const CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,

  // Anthropic
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-2.1': 200000,
  'claude-2': 100000,
  'claude-instant-1.2': 100000,

  // Gemini
  'gemini-pro': 32760,
  'gemini-1.5-pro': 1048576,
  'gemini-1.5-flash': 1048576,

  // Ollama (varies by model, these are common defaults)
  'llama2': 4096,
  'llama3': 8192,
  'llama3.1': 131072,
  'llama3.2': 131072,
  'mistral': 8192,
  'mixtral': 32768,
  'phi3': 4096,
  'codellama': 16384,
  'qwen2': 32768,
  'qwen2.5': 131072,

  // Default fallback
  'default': 4096,
};

// Reserve tokens for response (safety margin)
const RESPONSE_RESERVE = 1024;

export interface TokenCount {
  total: number;
  messages: number;
  systemPrompt: number;
  userMessage: number;
  available: number;
  limit: number;
  exceeds: boolean;
  truncationNeeded: boolean;
}

export class ContextWindowService {
  /**
   * Get context window limit for a specific model
   */
  static getContextLimit(provider: AIProvider, model: string): number {
    // Try exact model match first
    if (CONTEXT_LIMITS[model]) {
      return CONTEXT_LIMITS[model];
    }

    // Try partial match (e.g., "llama3:8b" matches "llama3")
    const modelBase = model.split(':')[0].split('-')[0];
    if (CONTEXT_LIMITS[modelBase]) {
      return CONTEXT_LIMITS[modelBase];
    }

    // Provider defaults
    const providerDefaults: Record<string, number> = {
      openai: 4096,
      anthropic: 100000,
      gemini: 32760,
      ollama: 4096,
    };

    return providerDefaults[provider] || CONTEXT_LIMITS['default'];
  }

  /**
   * Estimate token count for text
   * Uses rough approximation: ~4 characters per token for English
   * More accurate counting would use tiktoken or similar
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;

    // Rough estimation: 1 token ≈ 4 characters
    // This is conservative - actual tokens may be fewer
    const charCount = text.length;
    return Math.ceil(charCount / 4);
  }

  /**
   * Count tokens in a conversation
   */
  static countConversationTokens(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    userMessage: string
  ): number {
    let total = 0;

    // System prompt
    total += this.estimateTokens(systemPrompt);

    // Conversation history
    for (const msg of messages) {
      total += this.estimateTokens(msg.content);
      total += 4; // Overhead for message formatting
    }

    // Current user message
    total += this.estimateTokens(userMessage);

    return total;
  }

  /**
   * Check if context fits within limit
   */
  static checkContextFit(
    provider: AIProvider,
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    userMessage: string
  ): TokenCount {
    const limit = this.getContextLimit(provider, model);
    const systemTokens = this.estimateTokens(systemPrompt);
    const messageTokens = messages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content) + 4,
      0
    );
    const userTokens = this.estimateTokens(userMessage);
    const total = systemTokens + messageTokens + userTokens;

    const available = limit - RESPONSE_RESERVE;
    const exceeds = total > available;
    const truncationNeeded = total > available * 0.8; // Warn at 80%

    return {
      total,
      messages: messageTokens,
      systemPrompt: systemTokens,
      userMessage: userTokens,
      available,
      limit,
      exceeds,
      truncationNeeded,
    };
  }

  /**
   * Truncate conversation history to fit within context window
   * Keeps most recent messages and system prompt
   */
  static truncateConversation(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    userMessage: string,
    maxTokens: number
  ): Array<{ role: string; content: string }> {
    const systemTokens = this.estimateTokens(systemPrompt);
    const userTokens = this.estimateTokens(userMessage);
    const reservedTokens = systemTokens + userTokens + RESPONSE_RESERVE;

    let availableForHistory = maxTokens - reservedTokens;

    if (availableForHistory <= 0) {
      logger.warn('No space for conversation history after system prompt and user message');
      return [];
    }

    // Keep most recent messages that fit
    const truncatedMessages: Array<{ role: string; content: string }> = [];
    let currentTokens = 0;

    // Process messages in reverse (most recent first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(messages[i].content) + 4;

      if (currentTokens + msgTokens <= availableForHistory) {
        truncatedMessages.unshift(messages[i]);
        currentTokens += msgTokens;
      } else {
        // Optionally add a summary message
        const removedCount = i + 1;
        logger.info(`Truncated ${removedCount} older messages to fit context window`);

        truncatedMessages.unshift({
          role: 'system',
          content: `[${removedCount} earlier messages truncated to fit context window]`,
        });
        break;
      }
    }

    return truncatedMessages;
  }

  /**
   * Prepare conversation for model with context management
   */
  static prepareConversation(
    provider: AIProvider,
    model: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    userMessage: string
  ): {
    messages: Array<{ role: string; content: string }>;
    warnings: string[];
    tokenCount: TokenCount;
  } {
    const warnings: string[] = [];
    const tokenCount = this.checkContextFit(provider, model, messages, systemPrompt, userMessage);

    let processedMessages = messages;

    if (tokenCount.exceeds) {
      warnings.push(
        `Context window exceeded: ${tokenCount.total} tokens > ${tokenCount.available} available (limit: ${tokenCount.limit})`
      );
      warnings.push('Truncating conversation history to fit');

      processedMessages = this.truncateConversation(
        messages,
        systemPrompt,
        userMessage,
        tokenCount.limit
      );

      logger.warn(
        `Context truncated for ${provider}:${model} - ${messages.length} -> ${processedMessages.length} messages`
      );
    } else if (tokenCount.truncationNeeded) {
      warnings.push(
        `Approaching context limit: ${tokenCount.total} / ${tokenCount.available} tokens (${Math.round((tokenCount.total / tokenCount.available) * 100)}%)`
      );
    }

    return {
      messages: processedMessages,
      warnings,
      tokenCount,
    };
  }
}
