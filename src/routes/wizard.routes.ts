/**
 * Wizard Flow Routes
 * Refactored to use controllers and middlewares
 */

import express from 'express';
import { upload } from '../config/upload';
import {
  UploadController,
  PromptController,
  ProcessingController,
  ClarificationController,
  ResultController,
  SessionController,
} from '../controllers';
import {
  validateSession,
  validateFileUpload,
  validateRequiredFields,
  asyncHandler,
} from '../middlewares';
import {
  uploadFilesSchema,
  submitPromptsSchema,
  clarificationResponseSchema,
  confirmResultSchema,
  modifyResultSchema,
} from '../validators/wizard.validator';

const router = express.Router();

/**
 * Validation middleware factory for Joi schemas
 */
const validateBody = (schema: any) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

// ==================== FILE UPLOAD ====================

/**
 * STEP 1: Upload Files
 * POST /api/wizard/upload
 */
router.post(
  '/upload',
  upload.array('files', 10),
  validateFileUpload,
  validateBody(uploadFilesSchema),
  asyncHandler(UploadController.uploadFiles)
);

// ==================== PROMPTS ====================

/**
 * STEP 2: Submit Prompts
 * POST /api/wizard/prompts
 */
router.post(
  '/prompts',
  validateBody(submitPromptsSchema),
  asyncHandler(PromptController.submitPrompts)
);

// ==================== PROCESSING STATUS ====================

/**
 * STEP 3: Get Processing Status
 * GET /api/wizard/status/:sessionId
 */
router.get('/status/:sessionId', asyncHandler(ProcessingController.getStatus));

// ==================== CLARIFICATIONS ====================

/**
 * STEP 4: Get Clarifications
 * GET /api/wizard/clarifications/:sessionId
 */
router.get('/clarifications/:sessionId', asyncHandler(ClarificationController.getClarifications));

/**
 * STEP 4: Respond to Clarification
 * POST /api/wizard/clarifications/respond
 */
router.post(
  '/clarifications/respond',
  validateBody(clarificationResponseSchema),
  asyncHandler(ClarificationController.respondToClarification)
);

// ==================== RESULTS ====================

/**
 * STEP 5: Get Result
 * GET /api/wizard/result/:sessionId
 */
router.get('/result/:sessionId', asyncHandler(ResultController.getResult));

/**
 * STEP 6: Confirm Result
 * POST /api/wizard/result/confirm
 */
router.post(
  '/result/confirm',
  validateBody(confirmResultSchema),
  asyncHandler(ResultController.confirmResult)
);

/**
 * STEP 6: Modify Result
 * POST /api/wizard/result/modify
 */
router.post(
  '/result/modify',
  validateBody(modifyResultSchema),
  asyncHandler(ResultController.modifyResult)
);

// ==================== SESSION & CONVERSATION ====================

/**
 * Get Conversation History
 * GET /api/wizard/conversation/:sessionId
 */
router.get('/conversation/:sessionId', asyncHandler(SessionController.getConversation));

/**
 * Get Session Details
 * GET /api/wizard/session/:sessionId
 */
router.get('/session/:sessionId', asyncHandler(SessionController.getSession));

export default router;
