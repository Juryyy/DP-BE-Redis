import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  MultiModelLLMService,
  ModelConfig,
  createMultiModelConfig,
} from '../services/multi-model-llm.service';
import { CZECH_SYSTEM_PROMPT } from '../constants';

export class MultiModelController {
  /**
   * Execute a prompt with multiple models
   * POST /api/wizard/multi-model/execute
   */
  static async execute(req: Request, res: Response): Promise<void> {
    try {
      const { prompt, systemPrompt, models, sessionId } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          error: 'Prompt is required',
        });
        return;
      }

      // Use provided models or default configuration
      const modelConfigs: ModelConfig[] = models || createMultiModelConfig();

      logger.info(`Executing multi-model request with ${modelConfigs.length} models`);

      const result = await MultiModelLLMService.executeMultiModel(
        prompt,
        systemPrompt || CZECH_SYSTEM_PROMPT,
        modelConfigs,
        sessionId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error in multi-model execution:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get comparison matrix for model results
   * POST /api/wizard/multi-model/compare
   */
  static async compare(req: Request, res: Response): Promise<void> {
    try {
      const { results } = req.body;

      if (!results || !Array.isArray(results)) {
        res.status(400).json({
          success: false,
          error: 'Results array is required',
        });
        return;
      }

      const comparisonMatrix = MultiModelLLMService.generateComparisonMatrix(results);
      const fastestResult = MultiModelLLMService.getFastestResult(results);
      const consensusResult = MultiModelLLMService.getConsensusResult(results);

      res.json({
        success: true,
        data: {
          comparisonMatrix,
          fastestResult,
          consensusResult,
        },
      });
    } catch (error) {
      logger.error('Error in model comparison:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Get current multi-model configuration
   * GET /api/wizard/multi-model/config
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = createMultiModelConfig();

      res.json({
        success: true,
        data: {
          models: config,
          enabledCount: config.filter((m) => m.enabled !== false).length,
        },
      });
    } catch (error) {
      logger.error('Error getting multi-model config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Update multi-model configuration
   * POST /api/wizard/multi-model/config
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { models } = req.body;

      if (!models || !Array.isArray(models)) {
        res.status(400).json({
          success: false,
          error: 'Models array is required',
        });
        return;
      }

      // Validate model configs
      for (const model of models) {
        if (!model.provider) {
          res.status(400).json({
            success: false,
            error: 'Each model must have a provider',
          });
          return;
        }
      }

      // Store configuration (in a real app, this would save to database or environment)
      // For now, just return the validated config
      res.json({
        success: true,
        data: {
          models,
          message: 'Configuration validated. Note: Configuration is not persisted across restarts.',
        },
      });
    } catch (error) {
      logger.error('Error updating multi-model config:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
}
