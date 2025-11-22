import { logger } from '../utils/logger';
import { LLMService, createLLMService, AIProvider } from './llm.service';
import { websocketService } from './websocket.service';

export interface ModelConfig {
  provider: AIProvider;
  model?: string;
  enabled?: boolean;
  priority?: number;
  baseUrl?: string; // For remote Ollama instances
}

export interface MultiModelResult {
  modelName: string;
  provider: string;
  duration: number; // milliseconds
  result: string;
  status: 'completed' | 'failed';
  error?: string;
  tokensUsed?: number;
  timestamp: string;
}

export interface MultiModelResponse {
  results: MultiModelResult[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
  combinedResult?: string;
}

export class MultiModelLLMService {
  /**
   * Execute prompt with multiple models in parallel
   */
  static async executeMultiModel(
    prompt: string,
    systemPrompt: string,
    modelConfigs: ModelConfig[],
    sessionId?: string,
    conversationHistory?: any[]
  ): Promise<MultiModelResponse> {
    const startTime = Date.now();
    const enabledModels = modelConfigs.filter((config) => config.enabled !== false);

    if (enabledModels.length === 0) {
      throw new Error('No models enabled for execution');
    }

    logger.info(`Executing prompt with ${enabledModels.length} models in parallel`);

    // Execute all models in parallel
    const promises = enabledModels.map((config) =>
      this.executeSingleModel(prompt, systemPrompt, config, sessionId, conversationHistory)
    );

    const results = await Promise.allSettled(promises);

    // Process results
    const modelResults: MultiModelResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          modelName: enabledModels[index].model || 'unknown',
          provider: enabledModels[index].provider,
          duration: 0,
          result: '',
          status: 'failed' as const,
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    });

    const totalDuration = Date.now() - startTime;
    const successCount = modelResults.filter((r) => r.status === 'completed').length;
    const failureCount = modelResults.filter((r) => r.status === 'failed').length;

    // Optionally combine results
    const combinedResult = this.combineResults(modelResults);

    logger.info(
      `Multi-model execution completed in ${totalDuration}ms: ${successCount} succeeded, ${failureCount} failed`
    );

    return {
      results: modelResults,
      totalDuration,
      successCount,
      failureCount,
      combinedResult,
    };
  }

  /**
   * Execute prompt with a single model and track timing
   */
  private static async executeSingleModel(
    prompt: string,
    systemPrompt: string,
    config: ModelConfig,
    sessionId?: string,
    conversationHistory?: any[]
  ): Promise<MultiModelResult> {
    const startTime = Date.now();
    const modelName = config.model || 'default';

    try {
      logger.info(`Starting execution with model: ${modelName} (${config.provider})`);

      // Broadcast that this model is processing (if sessionId provided)
      if (sessionId) {
        websocketService.broadcastModelResult({
          sessionId,
          modelName,
          duration: 0,
          result: '',
          status: 'processing',
          timestamp: new Date().toISOString(),
        });
      }

      // Create LLM service for this specific model
      const llmService = await createLLMService(config.provider, config.model, config.baseUrl);

      // Execute the prompt - use chat method if conversation history provided
      let response;
      if (conversationHistory && conversationHistory.length > 0) {
        // Build chat messages with history
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...conversationHistory,
          { role: 'user' as const, content: prompt },
        ];
        response = await llmService.chat(messages);
      } else {
        // Use simple complete for first message
        response = await llmService.complete(prompt, systemPrompt);
      }

      const duration = Date.now() - startTime;

      const result: MultiModelResult = {
        modelName: response.model || modelName,
        provider: config.provider,
        duration,
        result: response.content,
        status: 'completed',
        tokensUsed: response.tokensUsed,
        timestamp: new Date().toISOString(),
      };

      logger.info(
        `Model ${modelName} completed in ${duration}ms, tokens: ${response.tokensUsed || 'unknown'}`
      );

      // Broadcast completion (if sessionId provided)
      if (sessionId) {
        websocketService.broadcastModelResult({
          sessionId,
          modelName: result.modelName,
          duration: result.duration,
          result: result.result,
          status: 'completed',
          timestamp: result.timestamp,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Model ${modelName} failed after ${duration}ms:`, error);

      const result: MultiModelResult = {
        modelName,
        provider: config.provider,
        duration,
        result: '',
        status: 'failed',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };

      // Broadcast failure (if sessionId provided)
      if (sessionId) {
        websocketService.broadcastModelResult({
          sessionId,
          modelName: result.modelName,
          duration: result.duration,
          result: '',
          status: 'failed',
          error: errorMessage,
          timestamp: result.timestamp,
        });
      }

      return result;
    }
  }

  /**
   * Combine results from multiple models into a structured format
   */
  private static combineResults(results: MultiModelResult[]): string {
    const successfulResults = results.filter((r) => r.status === 'completed');

    if (successfulResults.length === 0) {
      return 'All models failed to generate a response.';
    }

    let combined = '# Multi-Model Results\n\n';

    results.forEach((result, index) => {
      combined += `## Model ${index + 1}: ${result.modelName}\n\n`;
      combined += `**Provider:** ${result.provider}  \n`;
      combined += `**Duration:** ${result.duration}ms  \n`;

      if (result.tokensUsed) {
        combined += `**Tokens Used:** ${result.tokensUsed}  \n`;
      }

      combined += `**Status:** ${result.status === 'completed' ? '✓ Success' : '✗ Failed'}  \n\n`;

      if (result.status === 'completed') {
        combined += `**Response:**\n\n${result.result}\n\n`;
      } else if (result.error) {
        combined += `**Error:** ${result.error}\n\n`;
      }

      combined += '---\n\n';
    });

    return combined;
  }

  /**
   * Get comparison matrix for multiple model results
   */
  static generateComparisonMatrix(results: MultiModelResult[]): string {
    const headers = ['Model', 'Provider', 'Duration (ms)', 'Tokens', 'Status', 'Result Preview'];
    const rows: string[][] = [];

    results.forEach((result) => {
      const preview =
        result.status === 'completed'
          ? result.result.substring(0, 100) + (result.result.length > 100 ? '...' : '')
          : result.error || 'Failed';

      rows.push([
        result.modelName,
        result.provider,
        result.duration.toString(),
        result.tokensUsed?.toString() || 'N/A',
        result.status === 'completed' ? '✓' : '✗',
        preview,
      ]);
    });

    // Create markdown table
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    rows.forEach((row) => {
      table += '| ' + row.join(' | ') + ' |\n';
    });

    return table;
  }

  /**
   * Get fastest successful model result
   */
  static getFastestResult(results: MultiModelResult[]): MultiModelResult | null {
    const successful = results.filter((r) => r.status === 'completed');

    if (successful.length === 0) {
      return null;
    }

    return successful.reduce((fastest, current) =>
      current.duration < fastest.duration ? current : fastest
    );
  }

  /**
   * Get consensus result (if multiple models agree)
   */
  static getConsensusResult(results: MultiModelResult[], threshold: number = 0.5): string | null {
    const successful = results.filter((r) => r.status === 'completed');

    if (successful.length === 0) {
      return null;
    }

    // Simple similarity check - count models with similar responses
    // This is a basic implementation - could be enhanced with proper NLP similarity
    const resultGroups = new Map<string, number>();

    successful.forEach((result) => {
      const normalized = result.result.trim().toLowerCase();
      const existing = Array.from(resultGroups.keys()).find((key) => {
        // Very basic similarity - could use Levenshtein distance or embeddings
        return normalized.includes(key) || key.includes(normalized);
      });

      if (existing) {
        resultGroups.set(existing, (resultGroups.get(existing) || 0) + 1);
      } else {
        resultGroups.set(normalized, 1);
      }
    });

    // Find most common result
    let maxCount = 0;
    let consensusResult: string | null = null;

    resultGroups.forEach((count, result) => {
      if (count > maxCount && count / successful.length >= threshold) {
        maxCount = count;
        consensusResult = result;
      }
    });

    return consensusResult;
  }
}

/**
 * Helper function to create multi-model configuration from environment
 */
export function createMultiModelConfig(): ModelConfig[] {
  const configs: ModelConfig[] = [];

  // Parse MULTI_MODEL_CONFIG environment variable
  // Format: "provider:model:enabled,provider:model:enabled"
  // Example: "ollama:llama3.1:true,ollama:mistral:true,openai:gpt-4:false"

  const multiModelConfig = process.env.MULTI_MODEL_CONFIG;

  if (multiModelConfig) {
    const configParts = multiModelConfig.split(',');

    configParts.forEach((part) => {
      const [provider, model, enabled = 'true', baseUrl] = part.split(':');

      if (provider) {
        configs.push({
          provider: provider as AIProvider,
          model,
          enabled: enabled.toLowerCase() === 'true',
          baseUrl,
        });
      }
    });
  } else {
    // Default: use current provider configuration
    const defaultProvider = (process.env.DEFAULT_AI_PROVIDER || 'ollama') as AIProvider;
    const defaultModel =
      defaultProvider === 'ollama'
        ? process.env.OLLAMA_MODEL
        : defaultProvider === 'openai'
          ? process.env.OPENAI_MODEL
          : process.env.GEMINI_MODEL;

    configs.push({
      provider: defaultProvider,
      model: defaultModel,
      enabled: true,
    });

    // Add remote Ollama if configured
    if (process.env.OLLAMA_REMOTE_URL) {
      configs.push({
        provider: 'ollama-remote' as AIProvider,
        model: process.env.OLLAMA_MODEL,
        enabled: true,
        baseUrl: process.env.OLLAMA_REMOTE_URL,
      });
    }
  }

  logger.info(`Multi-model configuration: ${configs.length} models configured`);
  return configs;
}
