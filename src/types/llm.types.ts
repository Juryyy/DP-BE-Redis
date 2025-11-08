/**
 * LLM and AI provider types
 */

export type AIProvider = 'ollama' | 'ollama-remote' | 'openai' | 'gemini';

export interface LLMConfig {
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  finishReason?: string;
}
