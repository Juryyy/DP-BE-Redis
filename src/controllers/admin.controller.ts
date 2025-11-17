/**
 * Admin Controller
 * Handles administrative operations like model management
 */

import { Request, Response } from 'express';
import { OllamaModelService } from '../services/ollama-model.service';
import { logger } from '../utils/logger';
import { DEFAULT_PROVIDER_URLS } from '../constants';
import axios from 'axios';

export class AdminController {
  /**
   * Get base URL for Ollama based on source parameter
   */
  private static getOllamaBaseUrl(source?: string): string {
    if (source === 'remote') {
      const remoteUrl = process.env.OLLAMA_REMOTE_URL;
      if (!remoteUrl) {
        throw new Error('OLLAMA_REMOTE_URL not configured');
      }
      return remoteUrl;
    }
    return process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;
  }

  /**
   * Sync models from Ollama to database
   * POST /api/admin/models/sync
   * Query params: source=local|remote (default: local)
   */
  static async syncModels(req: Request, res: Response): Promise<void> {
    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      await OllamaModelService.syncModelsFromOllama(baseUrl);

      const models = await OllamaModelService.getAllModels(true);

      res.json({
        success: true,
        message: `Models synced successfully from ${source} Ollama`,
        data: {
          source,
          baseUrl,
          totalModels: models.length,
          availableModels: models.filter((m) => m.isAvailable).length,
          enabledModels: models.filter((m) => m.isEnabled && m.isAvailable).length,
          models: models.map((m) => ({
            ...m,
            size: m.size ? m.size.toString() : null,
          })),
        },
      });
    } catch (error) {
      logger.error('Error syncing models:', error);
      res.status(500).json({
        error: 'Failed to sync models',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List all models
   * GET /api/admin/models
   */
  static async listModels(req: Request, res: Response): Promise<void> {
    const includeUnavailable = req.query.includeUnavailable === 'true';

    const models = await OllamaModelService.getAllModels(includeUnavailable);

    res.json({
      success: true,
      data: {
        models: models.map((m) => ({
          id: m.id,
          name: m.name,
          displayName: m.displayName,
          family: m.family,
          parameterSize: m.parameterSize,
          quantization: m.quantization,
          size: m.size ? m.size.toString() : null,
          isAvailable: m.isAvailable,
          isEnabled: m.isEnabled,
          priority: m.priority,
          maxTokens: m.maxTokens,
          temperature: m.temperature,
          contextWindow: m.contextWindow,
          usageCount: m.usageCount,
          lastUsed: m.lastUsed,
          lastChecked: m.lastChecked,
          createdAt: m.createdAt,
        })),
      },
    });
  }

  /**
   * List models directly from Ollama API (without database sync)
   * GET /api/admin/models/remote
   * Query params: source=local|remote (default: local)
   */
  static async listRemoteModels(req: Request, res: Response): Promise<void> {
    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      logger.info(`Querying models directly from ${source} Ollama at ${baseUrl}`);

      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 10000 });
      const models = response.data?.models || [];

      res.json({
        success: true,
        data: {
          source,
          baseUrl,
          totalModels: models.length,
          models: models.map((m: any) => ({
            name: m.name,
            size: m.size,
            digest: m.digest,
            modifiedAt: m.modified_at,
            details: m.details,
          })),
        },
      });
    } catch (error) {
      logger.error('Error listing remote models:', error);
      res.status(500).json({
        error: 'Failed to list models from Ollama',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Pull/download a model from Ollama
   * POST /api/admin/models/pull
   * Query params: source=local|remote (default: local)
   */
  static async pullModel(req: Request, res: Response): Promise<void> {
    const { modelName } = req.body;

    if (!modelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'modelName is required',
      });
      return;
    }

    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      OllamaModelService.pullModel(modelName, baseUrl)
        .then(async () => {
          await OllamaModelService.syncModelsFromOllama(baseUrl);
          logger.info(`Model ${modelName} pulled and synced successfully from ${source}`);
        })
        .catch((error) => {
          logger.error(`Failed to pull model ${modelName}:`, error);
        });

      res.json({
        success: true,
        message: `Started pulling model: ${modelName} from ${source} Ollama`,
        data: {
          modelName,
          source,
          baseUrl,
          status: 'pulling',
        },
      });
    } catch (error) {
      logger.error('Error initiating model pull:', error);
      res.status(500).json({
        error: 'Failed to pull model',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update model configuration
   * PATCH /api/admin/models/:id
   */
  static async updateModel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { displayName, isEnabled, priority, maxTokens, temperature, contextWindow } = req.body;

    try {
      const model = await OllamaModelService.updateModel(id, {
        displayName,
        isEnabled,
        priority,
        maxTokens,
        temperature,
        contextWindow,
      });

      res.json({
        success: true,
        message: 'Model updated successfully',
        data: {
          model: {
            ...model,
            size: model.size ? model.size.toString() : null,
          },
        },
      });
    } catch (error) {
      logger.error('Error updating model:', error);
      res.status(500).json({
        error: 'Failed to update model',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete model from database
   * DELETE /api/admin/models/:id
   */
  static async deleteModel(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      await OllamaModelService.deleteModel(id);

      res.json({
        success: true,
        message: 'Model removed from database',
      });
    } catch (error) {
      logger.error('Error deleting model:', error);
      res.status(500).json({
        error: 'Failed to delete model',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get recommended model for processing
   * GET /api/admin/models/recommended
   */
  static async getRecommendedModel(req: Request, res: Response): Promise<void> {
    try {
      const modelName = await OllamaModelService.getBestAvailableModel();

      if (!modelName) {
        res.status(404).json({
          error: 'No Available Models',
          message: 'No enabled models found. Please sync or enable models.',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          modelName,
          message: 'This model will be used for processing',
        },
      });
    } catch (error) {
      logger.error('Error getting recommended model:', error);
      res.status(500).json({
        error: 'Failed to get recommended model',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Test a model's functionality
   * POST /api/admin/models/test
   * Query params: source=local|remote (default: local)
   */
  static async testModel(req: Request, res: Response): Promise<void> {
    const { modelName } = req.body;

    if (!modelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'modelName is required',
      });
      return;
    }

    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      const result = await OllamaModelService.testModel(modelName, baseUrl);

      if (result.success) {
        res.json({
          success: true,
          message: `Model ${modelName} is working correctly on ${source} Ollama`,
          data: {
            modelName,
            source,
            baseUrl,
            testResponse: result.response,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Model Test Failed',
          message: result.error || 'Model did not respond',
          data: {
            modelName,
            source,
            baseUrl,
          },
        });
      }
    } catch (error) {
      logger.error('Error testing model:', error);
      res.status(500).json({
        error: 'Failed to test model',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check Ollama service health
   * GET /api/admin/ollama/health
   * Query params: source=local|remote (default: local)
   */
  static async checkOllamaHealth(req: Request, res: Response): Promise<void> {
    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      logger.info(`Checking Ollama health at ${baseUrl}`);

      const startTime = Date.now();
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      const modelCount = response.data?.models?.length || 0;

      res.json({
        success: true,
        data: {
          source,
          baseUrl,
          status: 'healthy',
          responseTimeMs: responseTime,
          modelCount,
        },
      });
    } catch (error) {
      logger.error('Ollama health check failed:', error);
      res.status(503).json({
        success: false,
        error: 'Ollama Service Unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          source: req.query.source || 'local',
          status: 'unhealthy',
        },
      });
    }
  }

  /**
   * Get Ollama service information
   * GET /api/admin/ollama/info
   * Query params: source=local|remote (default: local)
   */
  static async getOllamaInfo(req: Request, res: Response): Promise<void> {
    try {
      const source = (req.query.source as string) || 'local';
      const baseUrl = AdminController.getOllamaBaseUrl(source);

      logger.info(`Getting Ollama info from ${baseUrl}`);

      // Get version info
      const versionResponse = await axios.get(`${baseUrl}/api/version`, { timeout: 5000 }).catch(() => null);

      // Get models
      const modelsResponse = await axios.get(`${baseUrl}/api/tags`, { timeout: 10000 });
      const models = modelsResponse.data?.models || [];

      res.json({
        success: true,
        data: {
          source,
          baseUrl,
          version: versionResponse?.data?.version || 'unknown',
          totalModels: models.length,
          totalSize: models.reduce((acc: number, m: any) => acc + (m.size || 0), 0),
          models: models.map((m: any) => ({
            name: m.name,
            size: m.size,
            family: m.details?.family,
            parameterSize: m.details?.parameter_size,
            quantization: m.details?.quantization_level,
          })),
        },
      });
    } catch (error) {
      logger.error('Error getting Ollama info:', error);
      res.status(500).json({
        error: 'Failed to get Ollama info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
