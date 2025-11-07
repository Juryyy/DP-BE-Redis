import express, { Request, Response, NextFunction } from 'express';
import { upload } from '../config/upload';
import { SessionService } from '../services/session.service';
import { DocumentParserService } from '../services/document-parser.service';
import { TokenEstimatorService } from '../services/token-estimator.service';
import { ProcessingQueueService } from '../services/processing-queue.service';
import { ConversationService } from '../services/conversation.service';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import {
  uploadFilesSchema,
  submitPromptsSchema,
  clarificationResponseSchema,
  confirmResultSchema,
  modifyResultSchema,
} from '../validators/wizard.validator';
import { PromptStatus, ResultStatus, SessionStatus, TargetType, ConversationRole } from '@prisma/client';
import * as diff from 'diff';

const router = express.Router();

/**
 * STEP 1: Upload Files
 * POST /api/wizard/upload
 */
router.post('/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const { userId, metadata } = req.body;

    // Validate request
    const { error } = uploadFilesSchema.validate({ userId, metadata: metadata ? JSON.parse(metadata) : undefined });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Create session
    const session = await SessionService.createSession(
      userId,
      metadata ? JSON.parse(metadata) : undefined
    );

    // Process each file
    const fileMetadata = [];
    const allTexts = [];

    for (const file of files) {
      try {
        // Parse document
        const parsed = await DocumentParserService.parseDocument(
          file.path,
          file.originalname,
          file.mimetype
        );

        // Estimate tokens
        const tokenEstimate = await TokenEstimatorService.estimateTokens(parsed.text);

        // Save file to database
        const savedFile = await prisma.file.create({
          data: {
            sessionId: session.id,
            originalName: file.originalname,
            filename: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path,
            extractedText: parsed.text,
            metadata: parsed.metadata as any,
            sections: parsed.sections as any,
            tokenCount: tokenEstimate.tokenCount,
            modelCompatibility: tokenEstimate.modelCompatibility as any,
            processedAt: new Date(),
          },
        });

        fileMetadata.push({
          id: savedFile.id,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          tokenCount: tokenEstimate.tokenCount,
          sections: parsed.sections,
          tables: parsed.tables,
        });

        allTexts.push(parsed.text);
      } catch (error) {
        logger.error(`Error processing file ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    // Calculate overall token estimate
    const overallEstimate = await TokenEstimatorService.estimateMultipleFiles(allTexts);

    // Determine if can process
    const canProcess = overallEstimate.recommendations.length > 0 &&
      !overallEstimate.recommendations.some(r => r.includes('exceeds'));

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        files: fileMetadata,
        tokenEstimate: {
          total: overallEstimate.tokenCount,
          estimatedCost: overallEstimate.estimatedCost,
          recommendations: overallEstimate.recommendations,
        },
        modelCompatibility: overallEstimate.modelCompatibility,
        canProcess,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error in upload endpoint:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

/**
 * STEP 2: Submit Prompts
 * POST /api/wizard/prompts
 */
router.post('/prompts', async (req: Request, res: Response) => {
  try {
    const { error, value } = submitPromptsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sessionId, prompts } = value;

    // Verify session exists
    const session = await SessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create prompts in database
    const createdPrompts = [];
    for (const promptData of prompts) {
      const prompt = await prisma.prompt.create({
        data: {
          sessionId,
          content: promptData.content,
          priority: promptData.priority,
          targetType: promptData.targetType as TargetType,
          targetFileId: promptData.targetFileId,
          targetLines: promptData.targetLines,
          targetSection: promptData.targetSection,
          status: PromptStatus.PENDING,
        },
      });

      // If file-specific, create relationship
      if (promptData.targetFileId) {
        await prisma.promptFile.create({
          data: {
            promptId: prompt.id,
            fileId: promptData.targetFileId,
          },
        });
      }

      createdPrompts.push(prompt);
    }

    // Sort prompts by priority
    const sortedPrompts = createdPrompts.sort((a, b) => a.priority - b.priority);

    // Estimate processing time (rough estimate: 10 seconds per prompt)
    const estimatedTimeSeconds = sortedPrompts.length * 10;

    // Enqueue all prompts
    await ProcessingQueueService.enqueueMultiple(
      sortedPrompts.map(p => ({
        sessionId,
        promptId: p.id,
        priority: p.priority,
      }))
    );

    res.json({
      success: true,
      data: {
        sessionId,
        prompts: sortedPrompts.map(p => ({
          id: p.id,
          content: p.content,
          priority: p.priority,
          targetType: p.targetType,
          executionOrder: sortedPrompts.indexOf(p) + 1,
        })),
        estimatedTime: estimatedTimeSeconds,
        status: 'queued',
      },
    });
  } catch (error) {
    logger.error('Error in submit prompts endpoint:', error);
    res.status(500).json({ error: 'Failed to submit prompts' });
  }
});

/**
 * STEP 3: Get Processing Status
 * GET /api/wizard/status/:sessionId
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await SessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get prompts status
    const prompts = await prisma.prompt.findMany({
      where: { sessionId },
      orderBy: { priority: 'asc' },
    });

    // Get pending clarifications
    const pendingClarifications = await ConversationService.getPendingClarifications(sessionId);

    // Get latest result
    const latestResult = await prisma.result.findFirst({
      where: { sessionId },
      orderBy: { version: 'desc' },
    });

    const completedCount = prompts.filter(p => p.status === PromptStatus.COMPLETED).length;
    const totalCount = prompts.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    res.json({
      success: true,
      data: {
        sessionId,
        status: session.status,
        progress: Math.round(progress),
        prompts: {
          total: totalCount,
          completed: completedCount,
          processing: prompts.filter(p => p.status === PromptStatus.PROCESSING).length,
          pending: prompts.filter(p => p.status === PromptStatus.PENDING).length,
          failed: prompts.filter(p => p.status === PromptStatus.FAILED).length,
        },
        hasClarifications: pendingClarifications.length > 0,
        clarificationCount: pendingClarifications.length,
        hasResult: !!latestResult,
        result: latestResult ? {
          id: latestResult.id,
          version: latestResult.version,
          status: latestResult.status,
          createdAt: latestResult.createdAt,
        } : null,
      },
    });
  } catch (error) {
    logger.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * STEP 4: Get Clarifications
 * GET /api/wizard/clarifications/:sessionId
 */
router.get('/clarifications/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const clarifications = await ConversationService.getPendingClarifications(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        clarifications: clarifications.map(c => ({
          id: c.id,
          question: c.content,
          context: c.context,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error getting clarifications:', error);
    res.status(500).json({ error: 'Failed to get clarifications' });
  }
});

/**
 * STEP 4: Respond to Clarification
 * POST /api/wizard/clarifications/respond
 */
router.post('/clarifications/respond', async (req: Request, res: Response) => {
  try {
    const { error, value } = clarificationResponseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sessionId, clarificationId, response } = value;

    // Add user response to conversation
    await ConversationService.respondToClarification(sessionId, clarificationId, response);

    // Get the related prompt from clarification context
    const clarification = await prisma.conversation.findUnique({
      where: { id: clarificationId },
    });

    const context = clarification?.context as any;
    if (context?.promptId) {
      // Re-enqueue the prompt with the new context
      const prompt = await prisma.prompt.findUnique({
        where: { id: context.promptId },
      });

      if (prompt) {
        await ProcessingQueueService.enqueue(sessionId, prompt.id, prompt.priority);
      }
    }

    res.json({
      success: true,
      data: {
        sessionId,
        clarificationId,
        status: 'answered',
      },
    });
  } catch (error) {
    logger.error('Error responding to clarification:', error);
    res.status(500).json({ error: 'Failed to respond to clarification' });
  }
});

/**
 * STEP 5: Get Result
 * GET /api/wizard/result/:sessionId
 */
router.get('/result/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { version } = req.query;

    let result;
    if (version) {
      result = await prisma.result.findFirst({
        where: { sessionId, version: parseInt(version as string) },
      });
    } else {
      result = await prisma.result.findFirst({
        where: { sessionId },
        orderBy: { version: 'desc' },
      });
    }

    if (!result) {
      // Generate result from completed prompts
      const prompts = await prisma.prompt.findMany({
        where: {
          sessionId,
          status: PromptStatus.COMPLETED,
        },
        orderBy: { priority: 'asc' },
      });

      if (prompts.length === 0) {
        return res.status(404).json({ error: 'No results available yet' });
      }

      // Combine all results
      let combinedResult = '# Zpracovaný dokument\n\n';
      prompts.forEach((prompt, index) => {
        if (prompt.result) {
          combinedResult += `## Úkol ${index + 1}: ${prompt.content}\n\n`;
          combinedResult += prompt.result + '\n\n---\n\n';
        }
      });

      // Create result
      result = await prisma.result.create({
        data: {
          sessionId,
          version: 1,
          content: combinedResult,
          format: 'markdown',
          status: ResultStatus.PENDING_CONFIRMATION,
          metadata: {
            promptCount: prompts.length,
            generatedAt: new Date(),
          },
        },
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        result: {
          id: result.id,
          version: result.version,
          content: result.content,
          format: result.format,
          status: result.status,
          metadata: result.metadata,
          createdAt: result.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting result:', error);
    res.status(500).json({ error: 'Failed to get result' });
  }
});

/**
 * STEP 5: Confirm Result
 * POST /api/wizard/result/confirm
 */
router.post('/result/confirm', async (req: Request, res: Response) => {
  try {
    const { error, value } = confirmResultSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sessionId, resultId, action } = value;

    const result = await prisma.result.findUnique({
      where: { id: resultId },
    });

    if (!result || result.sessionId !== sessionId) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (action === 'CONFIRM') {
      // Confirm result
      await prisma.result.update({
        where: { id: resultId },
        data: {
          status: ResultStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Update session status
      await SessionService.updateSessionStatus(sessionId, SessionStatus.COMPLETED);

      // Persist conversation to DB and clear Redis
      await ConversationService.persistAndClearRedis(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          resultId,
          status: 'confirmed',
          message: 'Document confirmed successfully',
        },
      });
    } else if (action === 'REGENERATE') {
      // Mark current result as draft
      await prisma.result.update({
        where: { id: resultId },
        data: { status: ResultStatus.DRAFT },
      });

      // Reset prompts
      await prisma.prompt.updateMany({
        where: { sessionId },
        data: { status: PromptStatus.PENDING },
      });

      // Re-enqueue all prompts
      const prompts = await prisma.prompt.findMany({
        where: { sessionId },
        orderBy: { priority: 'asc' },
      });

      await ProcessingQueueService.enqueueMultiple(
        prompts.map(p => ({
          sessionId,
          promptId: p.id,
          priority: p.priority,
        }))
      );

      res.json({
        success: true,
        data: {
          sessionId,
          status: 'regenerating',
          message: 'Regenerating document',
        },
      });
    } else {
      // MODIFY - return to modification step
      res.json({
        success: true,
        data: {
          sessionId,
          resultId,
          status: 'ready_for_modification',
          message: 'Ready for modifications',
        },
      });
    }
  } catch (error) {
    logger.error('Error confirming result:', error);
    res.status(500).json({ error: 'Failed to confirm result' });
  }
});

/**
 * STEP 6: Modify Result
 * POST /api/wizard/result/modify
 */
router.post('/result/modify', async (req: Request, res: Response) => {
  try {
    const { error, value } = modifyResultSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { sessionId, resultId, modifications } = value;

    const currentResult = await prisma.result.findUnique({
      where: { id: resultId },
    });

    if (!currentResult || currentResult.sessionId !== sessionId) {
      return res.status(404).json({ error: 'Result not found' });
    }

    let newContent = currentResult.content;
    const newVersion = currentResult.version + 1;

    if (typeof modifications === 'string') {
      // Direct edit
      newContent = modifications;
    } else if (Array.isArray(modifications)) {
      // New prompts - create and process them
      for (const mod of modifications) {
        const prompt = await prisma.prompt.create({
          data: {
            sessionId,
            content: mod.content,
            priority: mod.priority,
            targetType: TargetType.GLOBAL,
            status: PromptStatus.PENDING,
          },
        });

        await ProcessingQueueService.enqueue(sessionId, prompt.id, mod.priority);
      }

      // Wait for processing (in real app, this would be async)
      return res.json({
        success: true,
        data: {
          sessionId,
          status: 'processing_modifications',
          message: 'Processing modification prompts',
        },
      });
    }

    // Create new version
    const newResult = await prisma.result.create({
      data: {
        sessionId,
        version: newVersion,
        content: newContent,
        format: currentResult.format,
        status: ResultStatus.PENDING_CONFIRMATION,
        metadata: {
          ...currentResult.metadata as any,
          modifiedFrom: resultId,
          modifiedAt: new Date(),
        },
      },
    });

    // Mark old result as modified
    await prisma.result.update({
      where: { id: resultId },
      data: { status: ResultStatus.MODIFIED },
    });

    // Generate diff
    const changes = diff.diffLines(currentResult.content, newContent);

    res.json({
      success: true,
      data: {
        sessionId,
        result: {
          id: newResult.id,
          version: newResult.version,
          content: newResult.content,
        },
        diff: changes,
        previousVersion: currentResult.version,
      },
    });
  } catch (error) {
    logger.error('Error modifying result:', error);
    res.status(500).json({ error: 'Failed to modify result' });
  }
});

/**
 * Get conversation history
 * GET /api/wizard/conversation/:sessionId
 */
router.get('/conversation/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const conversation = await ConversationService.getConversationHistory(
      sessionId,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: {
        sessionId,
        messages: conversation,
      },
    });
  } catch (error) {
    logger.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * Get session details
 * GET /api/wizard/session/:sessionId
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        files: true,
        prompts: {
          orderBy: { priority: 'asc' },
        },
        results: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const conversationSummary = await ConversationService.getConversationSummary(sessionId);

    res.json({
      success: true,
      data: {
        session,
        conversation: conversationSummary,
      },
    });
  } catch (error) {
    logger.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

export default router;
