/**
 * AI Provider and Model types
 * These mirror the backend types for consistency
 */

export type AIProviderType = 'local' | 'api' | 'remote';

export type AIProviderName = 'ollama' | 'openai' | 'anthropic' | 'gemini';

export interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  recommended?: boolean;
  costPer1kTokens?: number;
}

export interface AIProvider {
  type: AIProviderType;
  available: boolean;
  requiresApiKey?: boolean;
  models: AIModel[];
  baseUrl?: string;
}

export interface AIProviders {
  [key: string]: AIProvider;
}

export interface ProviderOptions {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface ModelConfigRequest {
  sessionId: string;
  provider: AIProviderName;
  model: string;
  apiKey?: string;
  options?: ProviderOptions;
}

export interface ModelConfigResponse {
  sessionId: string;
  provider: string;
  model: string;
  configured: boolean;
  estimatedCost?: number;
}
