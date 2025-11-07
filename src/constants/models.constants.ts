/**
 * AI Model configuration constants
 */

// Default model configurations
export const DEFAULT_MODEL_CONFIG = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
} as const;

// Default models for each provider
export const DEFAULT_MODELS = {
  openai: 'gpt-4-turbo-preview',
  gemini: 'gemini-1.5-pro',
  ollama: 'llama3.1:8b',
  'ollama-remote': 'llama3.1:8b',
} as const;

// Model token limits
export const MODEL_TOKEN_LIMITS = {
  'gpt-4-turbo-preview': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gemini-1.5-pro': 1048576, // 1M tokens
  'gemini-1.0-pro': 32768,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'llama3.1:8b': 128000,
  'llama3.1:70b': 128000,
  'mistral:7b': 32768,
  'mixtral:8x7b': 32768,
} as const;

// Default URLs for different providers
export const DEFAULT_PROVIDER_URLS = {
  ollama: 'http://localhost:11434',
} as const;

// Token estimation fallback ratio (1 token ≈ 4 characters)
export const TOKEN_TO_CHAR_RATIO = 4;
