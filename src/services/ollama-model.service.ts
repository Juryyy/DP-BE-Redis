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

      // Get models from Ollama
      const response = await axios.get(`${url}/api/tags`, { timeout: 10000 });
      const ollamaModels: OllamaModelInfo[] = response.data?.models || [];

      logger.info(`Found ${ollamaModels.length} models in Ollama`);

      // Get existing models from database
      const existingModels = await prisma.ollamaModel.findMany();
      const existingModelNames = new Set(existingModels.map(m => m.name));

      // Update or create models
      for (const model of ollamaModels) {
        await prisma.ollamaModel.upsert({
          where: { name: model.name },
          update: {
            isAvailable: true,
            size: model.size ? BigInt(model.size) : null,
            family: model.details?.family || model.details?.families?.[0] || null,
            parameterSize: model.details?.parameter_size || null,
            quantization: model.details?.quantization_level || null,
            lastChecked: new Date(),
          },
          create: {
            name: model.name,
            displayName: this.generateDisplayName(model.name),
            isAvailable: true,
            isEnabled: true,
            priority: this.calculatePriority(model.name),
            size: model.size ? BigInt(model.size) : null,
            family: model.details?.family || model.details?.families?.[0] || null,
            parameterSize: model.details?.parameter_size || null,
            quantization: model.details?.quantization_level || null,
          },
        });
      }

      // Mark models not in Ollama as unavailable
      const ollamaModelNames = new Set(ollamaModels.map(m => m.name));
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
      orderBy: [
        { priority: 'asc' },
        { usageCount: 'desc' },
      ],
    });

    if (model) {
      // Update usage tracking
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
   * Generate user-friendly display name
   */
  private static generateDisplayName(modelName: string): string {
    // Convert "llama3.1:8b" to "Llama 3.1 (8B)"
    const parts = modelName.split(':');
    const name = parts[0]
      .replace(/([a-z])([0-9])/gi, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase());

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
