/**
 * Admin Routes
 * Endpoints for administrative operations
 */

import express from 'express';
import { AdminController } from '../controllers/admin.controller';
import { asyncHandler } from '../middlewares';

const router = express.Router();

// ==================== MODEL MANAGEMENT ====================

/**
 * Sync models from Ollama to database
 * POST /api/admin/models/sync
 * Query params: source=local|remote (default: local)
 */
router.post('/models/sync', asyncHandler(AdminController.syncModels));

/**
 * List all models from database
 * GET /api/admin/models
 */
router.get('/models', asyncHandler(AdminController.listModels));

/**
 * List models directly from Ollama API (without database sync)
 * GET /api/admin/models/remote
 * Query params: source=local|remote (default: local)
 */
router.get('/models/remote', asyncHandler(AdminController.listRemoteModels));

/**
 * Get recommended model
 * GET /api/admin/models/recommended
 */
router.get('/models/recommended', asyncHandler(AdminController.getRecommendedModel));

/**
 * Test a model's functionality
 * POST /api/admin/models/test
 * Query params: source=local|remote (default: local)
 */
router.post('/models/test', asyncHandler(AdminController.testModel));

/**
 * Pull/download a model from Ollama
 * POST /api/admin/models/pull
 * Query params: source=local|remote (default: local)
 */
router.post('/models/pull', asyncHandler(AdminController.pullModel));

/**
 * Update model configuration
 * PATCH /api/admin/models/:id
 */
router.patch('/models/:id', asyncHandler(AdminController.updateModel));

/**
 * Delete model from database
 * DELETE /api/admin/models/:id
 */
router.delete('/models/:id', asyncHandler(AdminController.deleteModel));

// ==================== OLLAMA SERVICE MANAGEMENT ====================

/**
 * Check Ollama service health
 * GET /api/admin/ollama/health
 * Query params: source=local|remote (default: local)
 */
router.get('/ollama/health', asyncHandler(AdminController.checkOllamaHealth));

/**
 * Get Ollama service information
 * GET /api/admin/ollama/info
 * Query params: source=local|remote (default: local)
 */
router.get('/ollama/info', asyncHandler(AdminController.getOllamaInfo));

export default router;
