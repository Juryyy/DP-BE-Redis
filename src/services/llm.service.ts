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

export class LLMService {
  private config: LLMConfig;
  private model: BaseLanguageModel;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      ...config,
    };

    this.model = this.initializeModel();
  }

  /**
   * Initialize the appropriate model based on provider
   */
  private initializeModel(): BaseLanguageModel {
    const { provider, model, temperature, maxTokens } = this.config;

    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          temperature,
          maxTokens,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });

      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: model || process.env.GEMINI_MODEL || 'gemini-1.5-pro',
          temperature,
          maxOutputTokens: maxTokens,
          apiKey: process.env.GEMINI_API_KEY,
        });

      case 'ollama':
        return new Ollama({
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          model: model || process.env.OLLAMA_MODEL || 'llama3.1:8b',
          temperature,
        });

      case 'ollama-remote':
        return new Ollama({
          baseUrl: process.env.OLLAMA_REMOTE_URL || process.env.OLLAMA_BASE_URL,
          model: model || process.env.OLLAMA_MODEL || 'llama3.1:8b',
          temperature,
        });

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
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

      const response = await this.model.invoke(messages);

      return {
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
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

      return {
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
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
    const uncertaintyPatterns = [
      /nejsem si jistý/i,
      /nevím/i,
      /možná/i,
      /pravděpodobně/i,
      /not sure/i,
      /unclear/i,
      /ambiguous/i,
      /could be/i,
      /might be/i,
      /\?{2,}/,  // Multiple question marks
      /which one/i,
      /který z/i,
      /která z/i,
      /které z/i,
    ];

    return uncertaintyPatterns.some(pattern => pattern.test(response));
  }

  /**
   * Extract clarification questions from AI response
   */
  static extractClarificationQuestions(response: string): string[] {
    const lines = response.split('\n');
    const questions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.endsWith('?') && trimmed.length > 10) {
        questions.push(trimmed);
      }
    }

    return questions;
  }
}

/**
 * Factory function to create LLM service with default config
 */
export function createLLMService(overrides?: Partial<LLMConfig>): LLMService {
  const defaultConfig: LLMConfig = {
    provider: (process.env.DEFAULT_AI_PROVIDER as AIProvider) || 'ollama',
    model: undefined, // Will use provider's default
    temperature: 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS_PER_REQUEST || '4096'),
  };

  return new LLMService({ ...defaultConfig, ...overrides });
}
