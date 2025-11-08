import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Ollama } from '@langchain/ollama';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';
import { logger } from '../utils/logger';
import axios from 'axios';
import { AIProvider, LLMConfig, ChatMessage, LLMResponse } from '../types';
import {
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER_URLS,
  UNCERTAINTY_PATTERNS,
  PREFERRED_OLLAMA_MODELS,
  OLLAMA_MODEL_CACHE_TTL,
} from '../constants';
import { OllamaModelService } from './ollama-model.service';

// Re-export for backward compatibility
export { AIProvider, LLMConfig, ChatMessage, LLMResponse };

export class LLMService {
  private config: LLMConfig;
  private model: BaseLanguageModel;

  // Cache for available Ollama models
  private static ollamaModelsCache: { models: string[]; timestamp: number } | null = null;

  constructor(config: LLMConfig) {
    this.config = {
      ...DEFAULT_MODEL_CONFIG,
      ...config,
    };

    this.model = this.initializeModel();
  }

  /**
   * Query Ollama for available models
   */
  private static async getAvailableOllamaModels(baseUrl: string): Promise<string[]> {
    try {
      // Check cache first
      if (this.ollamaModelsCache && Date.now() - this.ollamaModelsCache.timestamp < OLLAMA_MODEL_CACHE_TTL) {
        logger.info('Using cached Ollama models');
        return this.ollamaModelsCache.models;
      }

      logger.info(`Querying Ollama at ${baseUrl} for available models...`);
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });

      if (response.data && response.data.models) {
        const models = response.data.models.map((m: any) => m.name);

        // Update cache
        this.ollamaModelsCache = {
          models,
          timestamp: Date.now(),
        };

        logger.info(`Found ${models.length} Ollama models:`, models.join(', '));
        return models;
      }

      return [];
    } catch (error) {
      logger.warn('Failed to query Ollama models:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Select the best available Ollama model
   * First tries database, then falls back to API detection
   */
  private static async selectOllamaModel(baseUrl: string, requestedModel?: string): Promise<string> {
    // Try to get model from database first
    try {
      const dbModel = await OllamaModelService.getBestAvailableModel();

      if (dbModel) {
        logger.info(`Using model from database: ${dbModel}`);
        return dbModel;
      }

      logger.info('No models in database, syncing from Ollama...');
      await OllamaModelService.syncModelsFromOllama(baseUrl);

      const syncedModel = await OllamaModelService.getBestAvailableModel();
      if (syncedModel) {
        logger.info(`Using synced model: ${syncedModel}`);
        return syncedModel;
      }
    } catch (error) {
      logger.warn('Failed to get model from database, falling back to API detection:', error);
    }

    // Fallback to original API-based detection
    const availableModels = await this.getAvailableOllamaModels(baseUrl);

    if (availableModels.length === 0) {
      logger.warn('No Ollama models found, using default model name');
      return requestedModel || DEFAULT_MODELS.ollama;
    }

    // If requested model exists, use it
    if (requestedModel && availableModels.includes(requestedModel)) {
      logger.info(`Using requested Ollama model: ${requestedModel}`);
      return requestedModel;
    }

    // Find first preferred model that's available
    for (const preferred of PREFERRED_OLLAMA_MODELS) {
      if (availableModels.includes(preferred)) {
        logger.info(`Using preferred available model: ${preferred}${requestedModel ? ` (requested: ${requestedModel} not found)` : ''}`);
        return preferred;
      }
    }

    // Fallback to first available model
    const fallback = availableModels[0];
    logger.warn(`Using fallback Ollama model: ${fallback}${requestedModel ? ` (requested: ${requestedModel} not found)` : ''}`);
    return fallback;
  }

  /**
   * Initialize the appropriate model based on provider
   */
  private initializeModel(): BaseLanguageModel {
    const { provider, model, temperature, maxTokens } = this.config;

    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: model || process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
          temperature: temperature,
          maxTokens: maxTokens,
          openAIApiKey: process.env.OPENAI_API_KEY,
        }) as any as BaseLanguageModel;

      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: model || process.env.GEMINI_MODEL || DEFAULT_MODELS.gemini,
          temperature: temperature,
          maxOutputTokens: maxTokens,
          apiKey: process.env.GEMINI_API_KEY,
        }) as any as BaseLanguageModel;

      case 'ollama':
        return new Ollama({
          baseUrl: process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama,
          model: model || DEFAULT_MODELS.ollama, // Model should be pre-selected
          temperature: temperature,
        }) as any as BaseLanguageModel;

      case 'ollama-remote':
        return new Ollama({
          baseUrl: process.env.OLLAMA_REMOTE_URL || process.env.OLLAMA_BASE_URL,
          model: model || DEFAULT_MODELS['ollama-remote'], // Model should be pre-selected
          temperature: temperature,
        }) as any as BaseLanguageModel;

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Async factory method to create LLMService with auto-detected models
   */
  static async create(config: LLMConfig): Promise<LLMService> {
    const finalConfig = { ...DEFAULT_MODEL_CONFIG, ...config };

    // Auto-detect Ollama model if needed
    if ((finalConfig.provider === 'ollama' || finalConfig.provider === 'ollama-remote') && !finalConfig.model) {
      const baseUrl = finalConfig.provider === 'ollama-remote'
        ? process.env.OLLAMA_REMOTE_URL || process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama
        : process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;

      const requestedModel = process.env.OLLAMA_MODEL;
      finalConfig.model = await this.selectOllamaModel(baseUrl, requestedModel);
    }

    return new LLMService(finalConfig);
  }

  /**
   * Generate a completion from a single prompt
   */
  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    try {
      const messages: BaseMessage[] = [];

      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }

      messages.push(new HumanMessage(prompt));

      logger.info(`Invoking ${this.config.provider} model: ${this.config.model}`);
      const response = await this.model.invoke(messages);
      logger.info(`Response received from ${this.config.provider}`, {
        hasContent: !!response.content,
        contentType: typeof response.content,
        isArray: Array.isArray(response.content),
        responseKeys: Object.keys(response).slice(0, 10),
      });

      let content: string;

      // Handle array response (LangChain Ollama returns arrays)
      if (Array.isArray(response.content)) {
        content = response.content.join('');
        logger.info(`Converted array response to string: ${content.length} characters`);
      }
      // Handle object with numeric keys (partial/chunked response)
      else if (response.content && typeof response.content === 'object' && !Array.isArray(response.content)) {
        const keys = Object.keys(response.content);
        if (keys.every(k => !isNaN(parseInt(k)))) {
          const sorted = keys.sort((a, b) => parseInt(a) - parseInt(b));
          content = sorted.map(k => (response.content as any)[k]).join('');
          logger.info(`Converted object response to string: ${content.length} characters from ${keys.length} chunks`);
        } else {
          content = JSON.stringify(response.content);
        }
      }
      // Handle string response
      else if (typeof response.content === 'string') {
        content = response.content;
      }
      // Handle other types
      else if (response.content !== null && response.content !== undefined) {
        content = JSON.stringify(response.content);
      }
      // Handle case where response itself is array-like (has numeric keys)
      else if (!response.content || response.content === undefined) {
        const responseKeys = Object.keys(response);
        if (responseKeys.length > 0 && responseKeys.every(k => !isNaN(parseInt(k)))) {
          const sorted = responseKeys.sort((a, b) => parseInt(a) - parseInt(b));
          content = sorted.map(k => (response as any)[k]).join('');
          logger.info(`Converted array-like response object to string: ${content.length} characters from ${responseKeys.length} chunks`);
        } else {
          logger.error('LLM returned empty response', {
            provider: this.config.provider,
            model: this.config.model,
            responseType: typeof response.content,
            isArray: Array.isArray(response.content),
            responseKeys: Object.keys(response).slice(0, 10),
          });
          content = '';
        }
      }
      // Truly empty
      else {
        logger.error('LLM returned empty response', {
          provider: this.config.provider,
          model: this.config.model,
          responseType: typeof response.content,
          isArray: Array.isArray(response.content),
        });
        content = '';
      }

      if (!content || content.trim().length === 0) {
        throw new Error('LLM returned empty content. The model may be unavailable or the prompt may be too large.');
      }

      return {
        content,
        provider: this.config.provider,
        model: this.config.model || 'default',
        tokensUsed: (response as any).usage?.total_tokens,
      };
    } catch (error) {
      logger.error('Error in LLM completion:', error);
      throw error;
    }
  }

  /**
   * Generate a completion from a conversation history
   */
  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    try {
      const langchainMessages = messages.map((msg) => {
        switch (msg.role) {
          case 'system':
            return new SystemMessage(msg.content);
          case 'user':
            return new HumanMessage(msg.content);
          case 'assistant':
            return new AIMessage(msg.content);
          default:
            throw new Error(`Unknown message role: ${msg.role}`);
        }
      });

      const response = await this.model.invoke(langchainMessages);

      let content: string;

      // Handle array response (LangChain Ollama returns arrays)
      if (Array.isArray(response.content)) {
        content = response.content.join('');
      }
      // Handle object with numeric keys (partial/chunked response)
      else if (response.content && typeof response.content === 'object' && !Array.isArray(response.content)) {
        const keys = Object.keys(response.content);
        if (keys.every(k => !isNaN(parseInt(k)))) {
          const sorted = keys.sort((a, b) => parseInt(a) - parseInt(b));
          content = sorted.map(k => (response.content as any)[k]).join('');
        } else {
          content = JSON.stringify(response.content);
        }
      }
      // Handle string response
      else if (typeof response.content === 'string') {
        content = response.content;
      }
      // Handle other types
      else if (response.content !== null && response.content !== undefined) {
        content = JSON.stringify(response.content);
      }
      // Handle case where response itself is array-like (has numeric keys)
      else if (!response.content || response.content === undefined) {
        const responseKeys = Object.keys(response);
        if (responseKeys.length > 0 && responseKeys.every(k => !isNaN(parseInt(k)))) {
          const sorted = responseKeys.sort((a, b) => parseInt(a) - parseInt(b));
          content = sorted.map(k => (response as any)[k]).join('');
          logger.info(`[chat] Converted array-like response object to string: ${content.length} characters from ${responseKeys.length} chunks`);
        } else {
          logger.error('LLM returned empty response', {
            provider: this.config.provider,
            model: this.config.model,
            responseType: typeof response.content,
            isArray: Array.isArray(response.content),
            responseKeys: Object.keys(response).slice(0, 10),
          });
          content = '';
        }
      }
      // Truly empty
      else {
        logger.error('LLM returned empty response', {
          provider: this.config.provider,
          model: this.config.model,
          responseType: typeof response.content,
          isArray: Array.isArray(response.content),
        });
        content = '';
      }

      if (!content || content.trim().length === 0) {
        throw new Error('LLM returned empty content. The model may be unavailable or the prompt may be too large.');
      }

      return {
        content,
        provider: this.config.provider,
        model: this.config.model || 'default',
        tokensUsed: (response as any).usage?.total_tokens,
      };
    } catch (error) {
      logger.error('Error in LLM chat:', error);
      throw error;
    }
  }

  /**
   * Stream a response (for real-time processing)
   */
  async *stream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    try {
      const messages: BaseMessage[] = [];

      if (systemPrompt) {
        messages.push(new SystemMessage(systemPrompt));
      }

      messages.push(new HumanMessage(prompt));

      const stream = await this.model.stream(messages);

      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' ? chunk.content : '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('Error in LLM streaming:', error);
      throw error;
    }
  }

  /**
   * Check if a specific model is available (especially for Ollama)
   */
  static async checkModelAvailability(provider: AIProvider, model: string): Promise<boolean> {
    if (provider === 'ollama' || provider === 'ollama-remote') {
      try {
        const baseUrl = provider === 'ollama-remote'
          ? process.env.OLLAMA_REMOTE_URL
          : process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

        const response = await axios.get(`${baseUrl}/api/tags`);
        const models = response.data.models || [];

        return models.some((m: any) => m.name === model || m.name.startsWith(model));
      } catch (error) {
        logger.error('Error checking Ollama model availability:', error);
        return false;
      }
    }

    // For cloud providers, assume availability (will fail at runtime if invalid)
    return true;
  }

  /**
   * List available models
   */
  static async listAvailableModels(provider: AIProvider): Promise<string[]> {
    if (provider === 'ollama' || provider === 'ollama-remote') {
      try {
        const baseUrl = provider === 'ollama-remote'
          ? process.env.OLLAMA_REMOTE_URL
          : process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

        const response = await axios.get(`${baseUrl}/api/tags`);
        const models = response.data.models || [];

        return models.map((m: any) => m.name);
      } catch (error) {
        logger.error('Error listing Ollama models:', error);
        return [];
      }
    }

    // Return default models for cloud providers
    switch (provider) {
      case 'openai':
        return ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
      case 'gemini':
        return ['gemini-1.5-pro', 'gemini-1.0-pro'];
      default:
        return [];
    }
  }

  /**
   * Create a chain for document processing
   */
  static createDocumentProcessingChain(
    llm: BaseLanguageModel,
    systemPrompt: string
  ): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', '{input}'],
    ]);

    const outputParser = new StringOutputParser();

    return RunnableSequence.from([prompt, llm, outputParser]);
  }

  /**
   * Detect uncertainty in AI response (for clarification step)
   */
  static detectUncertainty(response: string): boolean {
    return UNCERTAINTY_PATTERNS.some(pattern => pattern.test(response));
  }

  /**
   * Extract clarification questions from AI response
   */
  static extractClarificationQuestions(response: string): string[] {
    const questions: string[] = [];

    // Pattern 1: Extract questions from HTML comments with OTÁZKA/QUESTION markers
    const htmlCommentPattern = /<!--\s*(?:OTÁZKA|QUESTION)\?:\s*["""]?([^"""]+?)["""]?\s*-->/gi;
    let match;
    while ((match = htmlCommentPattern.exec(response)) !== null) {
      const question = match[1].trim();
      if (question.length > 5) {
        questions.push(question);
      }
    }

    // Pattern 2: Extract questions from lines with OTÁZKA/QUESTION markers
    const markerPattern = /(?:OTÁZKA|QUESTION)\?:\s*["""]?([^"""]+?)["""]?$/gmi;
    while ((match = markerPattern.exec(response)) !== null) {
      const question = match[1].trim();
      if (question.length > 5 && !questions.includes(question)) {
        questions.push(question);
      }
    }

    // Pattern 3: Extract plain questions (existing logic)
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip lines that are part of code blocks or already matched patterns
      if (trimmed.endsWith('?') &&
          trimmed.length > 10 &&
          !trimmed.includes('<!--') &&
          !trimmed.includes('OTÁZKA') &&
          !trimmed.includes('QUESTION') &&
          !questions.includes(trimmed)) {
        questions.push(trimmed);
      }
    }

    return questions;
  }
}

/**
 * Factory function to create LLM service with default config
 * @deprecated Use LLMService.create() instead for better model detection
 */
export async function createLLMService(overrides?: Partial<LLMConfig>): Promise<LLMService> {
  const defaultConfig: LLMConfig = {
    provider: (process.env.DEFAULT_AI_PROVIDER as AIProvider) || 'ollama',
    model: undefined, // Will be auto-detected for Ollama
    temperature: 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS_PER_REQUEST || '4096'),
  };

  return LLMService.create({ ...defaultConfig, ...overrides });
}
