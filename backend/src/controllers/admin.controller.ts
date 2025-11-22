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
   * Get local Ollama base URL
   */
  private static getLocalOllamaUrl(): string {
    return process.env.OLLAMA_BASE_URL || DEFAULT_PROVIDER_URLS.ollama;
  }

  /**
   * Get remote Ollama base URL
   */
  private static getRemoteOllamaUrl(): string {
    const remoteUrl = process.env.OLLAMA_REMOTE_URL;
    if (!remoteUrl) {
      throw new Error('OLLAMA_REMOTE_URL not configured');
    }
    return remoteUrl;
  }

  // ==================== LOCAL OLLAMA ENDPOINTS ====================

  /**
   * Sync models from local Ollama to database
   * POST /api/admin/models/sync
   */
  static async syncModels(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getLocalOllamaUrl();

      await OllamaModelService.syncModelsFromOllama(baseUrl);

      const models = await OllamaModelService.getAllModels(true);

      res.json({
        success: true,
        message: 'Models synced successfully from local Ollama',
        data: {
          source: 'local',
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
   * List all models from database
   * GET /api/admin/models
   * Query params: includeUnavailable, checkAvailability
   */
  static async listModels(req: Request, res: Response): Promise<void> {
    const includeUnavailable = req.query.includeUnavailable === 'true';
    const checkAvailability = req.query.checkAvailability !== 'false'; // Default true

    try {
      // Optionally sync with Ollama first to ensure fresh data
      if (checkAvailability) {
        try {
          await OllamaModelService.syncModelsFromOllama();
        } catch (error) {
          logger.warn('Could not sync with Ollama during listModels, using cached data');
        }
      }

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
    } catch (error) {
      logger.error('Error listing models:', error);
      res.status(500).json({
        error: 'Failed to list models',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List models directly from local Ollama API
   * GET /api/admin/models/available
   */
  static async listAvailableModels(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getLocalOllamaUrl();

      logger.info(`Querying models directly from local Ollama at ${baseUrl}`);

      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 10000 });
      const models = response.data?.models || [];

      res.json({
        success: true,
        data: {
          source: 'local',
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
      logger.error('Error listing local models:', error);
      res.status(500).json({
        error: 'Failed to list models from local Ollama',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Pull/download a model from local Ollama
   * POST /api/admin/models/pull
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
      const baseUrl = AdminController.getLocalOllamaUrl();

      OllamaModelService.pullModel(modelName, baseUrl)
        .then(async () => {
          await OllamaModelService.syncModelsFromOllama(baseUrl);
          logger.info(`Model ${modelName} pulled and synced successfully from local Ollama`);
        })
        .catch((error) => {
          logger.error(`Failed to pull model ${modelName}:`, error);
        });

      res.json({
        success: true,
        message: `Started pulling model: ${modelName} from local Ollama`,
        data: {
          modelName,
          source: 'local',
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
   * Pull/download a model with SSE progress streaming
   * GET /api/admin/models/pull/stream/:modelName
   */
  static async pullModelWithProgress(req: Request, res: Response): Promise<void> {
    const { modelName } = req.params;

    if (!modelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'modelName is required',
      });
      return;
    }

    try {
      const baseUrl = AdminController.getLocalOllamaUrl();

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Flush headers immediately
      res.flushHeaders();

      // Send initial connection message and flush
      res.write(`data: ${JSON.stringify({ type: 'connected', modelName, baseUrl })}\n\n`);
      if (res.flush) res.flush();

      // Set up keep-alive interval to prevent timeout (every 15 seconds)
      const keepAliveInterval = setInterval(() => {
        res.write(`: keep-alive\n\n`);
        if (res.flush) res.flush();
      }, 15000);

      // Pull model with progress callback
      OllamaModelService.pullModel(modelName, baseUrl, undefined, (progress) => {
        // Send progress event to client and flush immediately
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
        if (res.flush) res.flush();
      })
        .then(async () => {
          clearInterval(keepAliveInterval);

          // Sync models after successful pull
          await OllamaModelService.syncModelsFromOllama(baseUrl);

          // Send completion event
          res.write(`data: ${JSON.stringify({ type: 'complete', modelName })}\n\n`);
          res.end();
        })
        .catch((error) => {
          clearInterval(keepAliveInterval);

          // Send error event
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
          res.end();
        });

      // Handle client disconnect
      req.on('close', () => {
        clearInterval(keepAliveInterval);
        logger.info(`Client disconnected from pull stream for ${modelName}`);
      });
    } catch (error) {
      logger.error('Error initiating model pull with progress:', error);
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
   * Test a model's functionality on local Ollama
   * POST /api/admin/models/test
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
      const baseUrl = AdminController.getLocalOllamaUrl();

      const result = await OllamaModelService.testModel(modelName, baseUrl);

      if (result.success) {
        res.json({
          success: true,
          message: `Model ${modelName} is working correctly on local Ollama`,
          data: {
            modelName,
            source: 'local',
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
            source: 'local',
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
   * Check local Ollama service health
   * GET /api/admin/ollama/health
   */
  static async checkOllamaHealth(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getLocalOllamaUrl();

      logger.info(`Checking local Ollama health at ${baseUrl}`);

      const startTime = Date.now();
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      const modelCount = response.data?.models?.length || 0;

      res.json({
        success: true,
        data: {
          source: 'local',
          baseUrl,
          status: 'healthy',
          responseTimeMs: responseTime,
          modelCount,
        },
      });
    } catch (error) {
      logger.error('Local Ollama health check failed:', error);
      res.status(503).json({
        success: false,
        error: 'Ollama Service Unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          source: 'local',
          status: 'unhealthy',
        },
      });
    }
  }

  /**
   * Get local Ollama service information
   * GET /api/admin/ollama/info
   */
  static async getOllamaInfo(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getLocalOllamaUrl();

      logger.info(`Getting local Ollama info from ${baseUrl}`);

      const versionResponse = await axios.get(`${baseUrl}/api/version`, { timeout: 5000 }).catch(() => null);

      const modelsResponse = await axios.get(`${baseUrl}/api/tags`, { timeout: 10000 });
      const models = modelsResponse.data?.models || [];

      res.json({
        success: true,
        data: {
          source: 'local',
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
      logger.error('Error getting local Ollama info:', error);
      res.status(500).json({
        error: 'Failed to get Ollama info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== REMOTE OLLAMA ENDPOINTS ====================

  /**
   * Get axios config with ngrok headers to bypass interstitial page
   */
  private static getRemoteAxiosConfig(timeout: number = 10000) {
    return {
      timeout,
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'DP-BE-Redis/1.0',
      },
    };
  }

  /**
   * List models from remote Ollama API
   * GET /api/admin/ollama/remote/models
   */
  static async listRemoteModels(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getRemoteOllamaUrl();

      logger.info(`Querying models from remote Ollama at ${baseUrl}`);

      const response = await axios.get(`${baseUrl}/api/tags`, AdminController.getRemoteAxiosConfig());
      const models = response.data?.models || [];

      res.json({
        success: true,
        data: {
          source: 'remote',
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
        error: 'Failed to list models from remote Ollama',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Pull/download a model on remote Ollama
   * POST /api/admin/ollama/remote/pull
   */
  static async pullRemoteModel(req: Request, res: Response): Promise<void> {
    const { modelName } = req.body;

    if (!modelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'modelName is required',
      });
      return;
    }

    try {
      const baseUrl = AdminController.getRemoteOllamaUrl();
      const headers = {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'DP-BE-Redis/1.0',
      };

      OllamaModelService.pullModel(modelName, baseUrl, headers)
        .then(async () => {
          logger.info(`Model ${modelName} pulled successfully on remote Ollama`);
        })
        .catch((error) => {
          logger.error(`Failed to pull model ${modelName} on remote:`, error);
        });

      res.json({
        success: true,
        message: `Started pulling model: ${modelName} on remote Ollama`,
        data: {
          modelName,
          source: 'remote',
          baseUrl,
          status: 'pulling',
        },
      });
    } catch (error) {
      logger.error('Error initiating remote model pull:', error);
      res.status(500).json({
        error: 'Failed to pull model on remote Ollama',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Test a model on remote Ollama
   * POST /api/admin/ollama/remote/test
   */
  static async testRemoteModel(req: Request, res: Response): Promise<void> {
    const { modelName } = req.body;

    if (!modelName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'modelName is required',
      });
      return;
    }

    try {
      const baseUrl = AdminController.getRemoteOllamaUrl();
      const headers = {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'DP-BE-Redis/1.0',
      };

      const result = await OllamaModelService.testModel(modelName, baseUrl, headers);

      if (result.success) {
        res.json({
          success: true,
          message: `Model ${modelName} is working correctly on remote Ollama`,
          data: {
            modelName,
            source: 'remote',
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
            source: 'remote',
            baseUrl,
          },
        });
      }
    } catch (error) {
      logger.error('Error testing remote model:', error);
      res.status(500).json({
        error: 'Failed to test model on remote Ollama',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check remote Ollama service health
   * GET /api/admin/ollama/remote/health
   */
  static async checkRemoteOllamaHealth(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getRemoteOllamaUrl();

      logger.info(`Checking remote Ollama health at ${baseUrl}`);

      const startTime = Date.now();
      const response = await axios.get(`${baseUrl}/api/tags`, AdminController.getRemoteAxiosConfig(5000));
      const responseTime = Date.now() - startTime;

      const modelCount = response.data?.models?.length || 0;

      res.json({
        success: true,
        data: {
          source: 'remote',
          baseUrl,
          status: 'healthy',
          responseTimeMs: responseTime,
          modelCount,
        },
      });
    } catch (error) {
      logger.error('Remote Ollama health check failed:', error);
      res.status(503).json({
        success: false,
        error: 'Remote Ollama Service Unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          source: 'remote',
          status: 'unhealthy',
        },
      });
    }
  }

  /**
   * Get remote Ollama service information
   * GET /api/admin/ollama/remote/info
   */
  static async getRemoteOllamaInfo(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = AdminController.getRemoteOllamaUrl();

      logger.info(`Getting remote Ollama info from ${baseUrl}`);

      const versionResponse = await axios.get(`${baseUrl}/api/version`, AdminController.getRemoteAxiosConfig(5000)).catch(() => null);

      const modelsResponse = await axios.get(`${baseUrl}/api/tags`, AdminController.getRemoteAxiosConfig());
      const models = modelsResponse.data?.models || [];

      res.json({
        success: true,
        data: {
          source: 'remote',
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
      logger.error('Error getting remote Ollama info:', error);
      res.status(500).json({
        error: 'Failed to get remote Ollama info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all available AI providers with their models and metadata
   * GET /api/admin/models/providers
   */
  static async getProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers: any = {};

      // Local Ollama - Always sync first for fresh data
      try {
        const baseUrl = AdminController.getLocalOllamaUrl();

        // Sync with Ollama to get latest model list
        try {
          await OllamaModelService.syncModelsFromOllama(baseUrl);
        } catch (syncError) {
          logger.warn('Could not sync with Ollama, using cached data:', syncError instanceof Error ? syncError.message : 'Unknown error');
        }

        const models = await OllamaModelService.getAllModels(false);
        const availableModels = models.filter(m => m.isAvailable && m.isEnabled);

        providers.ollama = {
          id: 'ollama',
          name: 'Ollama (Local)',
          description: 'Run AI models locally on your machine',
          type: 'local',
          available: availableModels.length > 0,
          requiresApiKey: false,
          baseUrl,
          models: availableModels.map(m => ({
            id: m.name,
            name: m.displayName || m.name,
            contextWindow: m.contextWindow || 8192,
            parameterSize: m.parameterSize,
            recommended: m.priority === 1
          }))
        };
      } catch (error) {
        logger.warn('Local Ollama not available:', error instanceof Error ? error.message : 'Unknown error');
        providers.ollama = {
          id: 'ollama',
          name: 'Ollama (Local)',
          description: 'Run AI models locally on your machine',
          type: 'local',
          available: false,
          requiresApiKey: false,
          models: []
        };
      }

      // Remote Ollama
      if (process.env.OLLAMA_REMOTE_URL) {
        try {
          const baseUrl = AdminController.getRemoteOllamaUrl();
          const response = await axios.get(`${baseUrl}/api/tags`, AdminController.getRemoteAxiosConfig());
          const remoteModels = response.data?.models || [];

          providers.ollamaRemote = {
            id: 'ollamaRemote',
            name: 'Ollama (Remote)',
            description: 'Connect to a remote Ollama instance',
            type: 'remote',
            available: remoteModels.length > 0,
            requiresApiKey: false,
            baseUrl,
            models: remoteModels.map((m: any) => ({
              id: m.name,
              name: m.name,
              contextWindow: 8192,
              size: m.size
            }))
          };
        } catch (error) {
          logger.warn('Remote Ollama not available:', error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // OpenAI
      providers.openai = {
        id: 'openai',
        name: 'OpenAI',
        description: 'Access GPT models from OpenAI',
        type: 'api',
        available: !!process.env.OPENAI_API_KEY,
        requiresApiKey: true,
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4 Omni',
            contextWindow: 128000,
            costPer1kTokens: 0.005,
            recommended: true
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4 Omni Mini',
            contextWindow: 128000,
            costPer1kTokens: 0.00015
          },
          {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            contextWindow: 128000,
            costPer1kTokens: 0.01
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            contextWindow: 16385,
            costPer1kTokens: 0.0005
          }
        ]
      };

      // Anthropic
      providers.anthropic = {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Access Claude models from Anthropic',
        type: 'api',
        available: !!process.env.ANTHROPIC_API_KEY,
        requiresApiKey: true,
        models: [
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            contextWindow: 200000,
            costPer1kTokens: 0.003,
            recommended: true
          },
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            contextWindow: 200000,
            costPer1kTokens: 0.015
          },
          {
            id: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            contextWindow: 200000,
            costPer1kTokens: 0.00025
          }
        ]
      };

      // Google Gemini
      providers.gemini = {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Access Gemini models from Google',
        type: 'api',
        available: !!process.env.GEMINI_API_KEY,
        requiresApiKey: true,
        models: [
          {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            contextWindow: 1000000,
            costPer1kTokens: 0.00125,
            recommended: true
          },
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            contextWindow: 1000000,
            costPer1kTokens: 0.000075
          }
        ]
      };

      // Determine default provider
      let defaultProvider = 'ollama';
      let defaultModel = '';

      if (providers.ollama.available && providers.ollama.models.length > 0) {
        defaultProvider = 'ollama';
        const recommended = providers.ollama.models.find((m: any) => m.recommended);
        defaultModel = recommended ? recommended.id : providers.ollama.models[0].id;
      } else if (providers.openai.available) {
        defaultProvider = 'openai';
        defaultModel = 'gpt-4o-mini';
      } else if (providers.anthropic.available) {
        defaultProvider = 'anthropic';
        defaultModel = 'claude-3-5-sonnet-20241022';
      }

      res.json({
        success: true,
        data: {
          providers,
          default: defaultProvider,
          defaultModel
        }
      });
    } catch (error) {
      logger.error('Error getting providers:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({
        error: 'Failed to get providers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
