/**
 * Ollama Model Management Service
 * Handles model discovery, storage, and configuration
 */

import axios from 'axios';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { DEFAULT_PROVIDER_URLS } from '../constants';
import { OllamaModelInfo, OllamaModelUpdate } from '../types';

export class OllamaModelService {
  /**
   * Sync models from Ollama to database
   */
  static async syncModelsFromOllama(baseUrl?: string): Promise<void> {
    const url = baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;

    try {
      logger.info(`Syncing models from Ollama at ${url}...`);

      const response = await axios.get(`${url}/api/tags`, { timeout: 10000 });
      const ollamaModels: OllamaModelInfo[] = response.data?.models || [];

      logger.info(`Found ${ollamaModels.length} models in Ollama`);

      const existingModels = await prisma.ollamaModel.findMany();
      const existingModelNames = new Set(existingModels.map((m) => m.name));

      for (const model of ollamaModels) {
        const family = model.details?.family || model.details?.families?.[0] || null;
        const contextWindow = this.estimateContextWindow(model.name, family);

        await prisma.ollamaModel.upsert({
          where: { name: model.name },
          update: {
            isAvailable: true,
            size: model.size ? BigInt(model.size) : null,
            family,
            parameterSize: model.details?.parameter_size || null,
            quantization: model.details?.quantization_level || null,
            contextWindow,
            lastChecked: new Date(),
          },
          create: {
            name: model.name,
            displayName: this.generateDisplayName(model.name),
            isAvailable: true,
            isEnabled: true,
            priority: this.calculatePriority(model.name),
            size: model.size ? BigInt(model.size) : null,
            family,
            parameterSize: model.details?.parameter_size || null,
            quantization: model.details?.quantization_level || null,
            contextWindow,
          },
        });
      }

      const ollamaModelNames = new Set(ollamaModels.map((m) => m.name));
      for (const existing of existingModels) {
        if (!ollamaModelNames.has(existing.name)) {
          await prisma.ollamaModel.update({
            where: { id: existing.id },
            data: { isAvailable: false, lastChecked: new Date() },
          });
        }
      }

      logger.info('Model sync completed');
    } catch (error) {
      logger.error('Failed to sync models from Ollama:', error);
      throw error;
    }
  }

  /**
   * Get best available model from database
   */
  static async getBestAvailableModel(): Promise<string | null> {
    const model = await prisma.ollamaModel.findFirst({
      where: {
        isAvailable: true,
        isEnabled: true,
      },
      orderBy: [{ priority: 'asc' }, { usageCount: 'desc' }],
    });

    if (model) {
      await prisma.ollamaModel.update({
        where: { id: model.id },
        data: {
          lastUsed: new Date(),
          usageCount: { increment: 1 },
        },
      });
    }

    return model?.name || null;
  }

  /**
   * Get context window size for a specific model
   * Returns number of tokens or null if model not found
   */
  static async getModelContextWindow(modelName: string): Promise<number | null> {
    const model = await prisma.ollamaModel.findUnique({
      where: { name: modelName },
      select: { contextWindow: true, family: true },
    });

    if (!model) {
      // Model not in database, estimate based on name
      logger.warn(`Model ${modelName} not in database, estimating context window`);
      return this.estimateContextWindow(modelName, null);
    }

    return model.contextWindow;
  }

  /**
   * Get all models from database
   */
  static async getAllModels(includeUnavailable: boolean = false) {
    return prisma.ollamaModel.findMany({
      where: includeUnavailable ? undefined : { isAvailable: true },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Pull/download a model from Ollama
   */
  static async pullModel(modelName: string, baseUrl?: string): Promise<void> {
    const url = baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;

    try {
      logger.info(`Pulling model ${modelName} from Ollama...`);

      // Ollama pull is a streaming endpoint, we need to handle it differently
      const response = await axios.post(
        `${url}/api/pull`,
        { name: modelName },
        {
          timeout: 600000, // 10 minutes for large models
          responseType: 'stream',
        }
      );

      // Stream the response
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          try {
            const line = chunk.toString();
            const data = JSON.parse(line);

            if (data.status) {
              logger.info(`Pull ${modelName}: ${data.status}`);
            }

            if (data.error) {
              reject(new Error(data.error));
            }
          } catch (e) {
            // Ignore JSON parse errors for partial chunks
          }
        });

        response.data.on('end', () => {
          logger.info(`Model ${modelName} pulled successfully`);
          resolve();
        });

        response.data.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error(`Failed to pull model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Update model configuration
   */
  static async updateModel(id: string, updates: OllamaModelUpdate) {
    return prisma.ollamaModel.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Delete model from database (not from Ollama)
   */
  static async deleteModel(id: string) {
    return prisma.ollamaModel.delete({
      where: { id },
    });
  }

  /**
   * Test if a specific model is working in Ollama
   */
  static async testModel(
    modelName: string,
    baseUrl?: string
  ): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    const url = baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;

    try {
      logger.info(`Testing model ${modelName} at ${url}...`);

      const response = await axios.post(
        `${url}/api/generate`,
        {
          model: modelName,
          prompt: 'Řekni "Funguje to!" česky.',
          stream: false,
        },
        { timeout: 30000 }
      );

      if (response.data && response.data.response) {
        logger.info(`Model ${modelName} test successful: ${response.data.response}`);
        return {
          success: true,
          response: response.data.response,
        };
      }

      logger.error(`Model ${modelName} returned no response`);
      return {
        success: false,
        error: 'No response from model',
      };
    } catch (error) {
      logger.error(`Model ${modelName} test failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Estimate context window size based on model name and family
   * Returns context window in tokens
   */
  private static estimateContextWindow(modelName: string, family?: string | null): number {
    const nameLower = modelName.toLowerCase();
    const familyLower = family?.toLowerCase() || '';

    // Llama 3.1 and later have 128K context
    if (nameLower.includes('llama3.1') || nameLower.includes('llama-3.1')) {
      return 128000;
    }

    // Llama 3 has 128K context
    if (nameLower.includes('llama3') || nameLower.includes('llama-3')) {
      return 128000;
    }

    // Llama 2 has 4K context
    if (nameLower.includes('llama2') || nameLower.includes('llama-2') || familyLower === 'llama') {
      return 4096;
    }

    // Mistral models typically have 8K context (some newer ones have 32K)
    if (nameLower.includes('mistral') || familyLower === 'mistral') {
      // Mistral Large/Medium have larger context
      if (nameLower.includes('large') || nameLower.includes('medium')) {
        return 32768;
      }
      return 8192;
    }

    // Qwen 2.5 has 32K context
    if (nameLower.includes('qwen2.5') || nameLower.includes('qwen-2.5')) {
      return 32768;
    }

    // Qwen 2 has 32K context
    if (nameLower.includes('qwen2') || nameLower.includes('qwen-2')) {
      return 32768;
    }

    // Gemma 2 has 8K context
    if (nameLower.includes('gemma2') || nameLower.includes('gemma-2') || familyLower === 'gemma') {
      return 8192;
    }

    // Phi models typically have 4K context
    if (nameLower.includes('phi') || familyLower === 'phi') {
      return 4096;
    }

    // CodeLlama has 16K context
    if (nameLower.includes('codellama') || nameLower.includes('code-llama')) {
      return 16384;
    }

    // Default conservative estimate for unknown models
    logger.warn(`Unknown model ${modelName}, using conservative 4K context window estimate`);
    return 4096;
  }

  /**
   * Generate user-friendly display name
   */
  private static generateDisplayName(modelName: string): string {
    // Convert "llama3.1:8b" to "Llama 3.1 (8B)"
    const parts = modelName.split(':');
    const name = parts[0]
      .replace(/([a-z])([0-9])/gi, '$1 $2')
      .replace(/\b\w/g, (l) => l.toUpperCase());

    const variant = parts[1] ? ` (${parts[1].toUpperCase()})` : '';
    return name + variant;
  }

  /**
   * Calculate default priority based on model name
   */
  private static calculatePriority(modelName: string): number {
    // Prefer smaller, faster models
    if (modelName.includes('llama3.1:8b')) return 10;
    if (modelName.includes('llama3:8b')) return 20;
    if (modelName.includes('mistral:7b')) return 30;
    if (modelName.includes('qwen2.5:7b')) return 40;
    if (modelName.includes('gemma2:9b')) return 50;

    // Larger models have lower priority (higher number)
    if (modelName.includes('70b') || modelName.includes('72b')) return 200;
    if (modelName.includes('13b') || modelName.includes('14b')) return 150;

    return 100; // Default priority
  }
}
