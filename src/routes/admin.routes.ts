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
 */
router.post('/models/sync', asyncHandler(AdminController.syncModels));

/**
 * List all models
 * GET /api/admin/models
 */
router.get('/models', asyncHandler(AdminController.listModels));

/**
 * Get recommended model
 * GET /api/admin/models/recommended
 */
router.get('/models/recommended', asyncHandler(AdminController.getRecommendedModel));

/**
 * Test a model's functionality
 * POST /api/admin/models/test
 */
router.post('/models/test', asyncHandler(AdminController.testModel));

/**
 * Pull/download a model from Ollama
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

export default router;
