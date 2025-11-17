/**
 * Admin Routes
 * Endpoints for administrative operations
 */

import express from 'express';
import { AdminController } from '../controllers/admin.controller';
import { asyncHandler } from '../middlewares';

const router = express.Router();

// ==================== LOCAL OLLAMA MODEL MANAGEMENT ====================

/**
 * Sync models from local Ollama to database
 * POST /api/admin/models/sync
 */
router.post('/models/sync', asyncHandler(AdminController.syncModels));

/**
 * List all models from database
 * GET /api/admin/models
 */
router.get('/models', asyncHandler(AdminController.listModels));

/**
 * List models directly from local Ollama API (without database sync)
 * GET /api/admin/models/available
 */
router.get('/models/available', asyncHandler(AdminController.listAvailableModels));

/**
 * Get recommended model
 * GET /api/admin/models/recommended
 */
router.get('/models/recommended', asyncHandler(AdminController.getRecommendedModel));

/**
 * Test a model's functionality on local Ollama
 * POST /api/admin/models/test
 */
router.post('/models/test', asyncHandler(AdminController.testModel));

/**
 * Pull/download a model from local Ollama
 * POST /api/admin/models/pull
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

// ==================== LOCAL OLLAMA SERVICE MANAGEMENT ====================

/**
 * Check local Ollama service health
 * GET /api/admin/ollama/health
 */
router.get('/ollama/health', asyncHandler(AdminController.checkOllamaHealth));

/**
 * Get local Ollama service information
 * GET /api/admin/ollama/info
 */
router.get('/ollama/info', asyncHandler(AdminController.getOllamaInfo));

// ==================== REMOTE OLLAMA SERVICE MANAGEMENT ====================

/**
 * List models from remote Ollama API
 * GET /api/admin/ollama/remote/models
 */
router.get('/ollama/remote/models', asyncHandler(AdminController.listRemoteModels));

/**
 * Pull/download a model on remote Ollama
 * POST /api/admin/ollama/remote/pull
 */
router.post('/ollama/remote/pull', asyncHandler(AdminController.pullRemoteModel));

/**
 * Test a model on remote Ollama
 * POST /api/admin/ollama/remote/test
 */
router.post('/ollama/remote/test', asyncHandler(AdminController.testRemoteModel));

/**
 * Check remote Ollama service health
 * GET /api/admin/ollama/remote/health
 */
router.get('/ollama/remote/health', asyncHandler(AdminController.checkRemoteOllamaHealth));

/**
 * Get remote Ollama service information
 * GET /api/admin/ollama/remote/info
 */
router.get('/ollama/remote/info', asyncHandler(AdminController.getRemoteOllamaInfo));

export default router;
