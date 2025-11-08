/**
 * Admin Controller
 * Handles administrative operations like model management
 */

import { Request, Response } from 'express';
import { OllamaModelService } from '../services/ollama-model.service';
import { logger } from '../utils/logger';

export class AdminController {
  /**
   * Sync models from Ollama to database
   * POST /api/admin/models/sync
   */
  static async syncModels(req: Request, res: Response): Promise<void> {
    try {
      await OllamaModelService.syncModelsFromOllama();

      const models = await OllamaModelService.getAllModels(true);

      res.json({
        success: true,
        message: 'Models synced successfully',
        data: {
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
   * Pull/download a model from Ollama
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
      OllamaModelService.pullModel(modelName)
        .then(async () => {
          await OllamaModelService.syncModelsFromOllama();
          logger.info(`Model ${modelName} pulled and synced successfully`);
        })
        .catch((error) => {
          logger.error(`Failed to pull model ${modelName}:`, error);
        });

      res.json({
        success: true,
        message: `Started pulling model: ${modelName}`,
        data: {
          modelName,
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
      const result = await OllamaModelService.testModel(modelName);

      if (result.success) {
        res.json({
          success: true,
          message: `Model ${modelName} is working correctly`,
          data: {
            modelName,
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
}
