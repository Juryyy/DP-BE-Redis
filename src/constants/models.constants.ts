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

// Model pricing per 1M tokens (in USD, as of 2024)
export const MODEL_PRICING = {
  'gpt-4-turbo-preview': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-1.0-pro': { input: 0.5, output: 1.5 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
} as const;

// Default pricing for unknown models
export const DEFAULT_MODEL_PRICING = { input: 1, output: 2 } as const;

// Output token estimation ratio (assume output is 20% of input)
export const OUTPUT_TOKEN_RATIO = 0.2;

// Model usage thresholds for recommendations (in tokens)
export const TOKEN_THRESHOLDS = {
  small: 8000,      // Use cost-effective models
  medium: 30000,    // Use mid-tier models
  large: 100000,    // Use large context models
  veryLarge: 50000, // Trigger warning
} as const;

// Model recommendations by token range
export const MODEL_RECOMMENDATIONS = {
  small: 'GPT-3.5-turbo or Llama 3.1 (cost-effective)',
  medium: 'GPT-4-turbo or Gemini 1.0 Pro',
  large: 'Claude 3 or Gemini 1.5 Pro (large context)',
  veryLarge: 'Gemini 1.5 Pro (1M token context)',
} as const;

// Warning and recommendation messages
export const TOKEN_MESSAGES = {
  exceedsLimits: '⚠️ Document exceeds most model limits. Consider splitting into smaller chunks.',
  compatible: (count: number) => `✓ Compatible with ${count} models`,
  largeDocument: '⚠️ Large document detected. Processing may take longer and cost more.',
} as const;

// Model safety buffer (use 80% of limit to leave room for response)
export const MODEL_SAFETY_BUFFER = 0.8;

// Preferred Ollama models in order of preference
// When auto-detecting, the first available model from this list will be used
export const PREFERRED_OLLAMA_MODELS = [
  'llama3.1:8b',
  'llama3.1:70b',
  'llama3:8b',
  'llama3:70b',
  'llama2:7b',
  'llama2:13b',
  'mistral:7b',
  'mixtral:8x7b',
  'qwen2.5:7b',
  'qwen2.5:14b',
  'gemma2:9b',
  'phi3:medium',
] as const;

// Cache settings for Ollama model detection
export const OLLAMA_MODEL_CACHE_TTL = 300000; // 5 minutes
