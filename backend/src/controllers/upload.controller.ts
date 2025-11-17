/**
 * Upload Controller
 * Handles file upload operations
 */

import { Request, Response } from 'express';
import { SessionService } from '../services/session.service';
import { DocumentParserService } from '../services/document-parser.service';
import { TokenEstimatorService } from '../services/token-estimator.service';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class UploadController {
  /**
   * STEP 1: Upload Files
   * POST /api/wizard/upload
   */
  static async uploadFiles(req: Request, res: Response): Promise<void> {
    const { userId, metadata } = req.body;
    const files = req.files as Express.Multer.File[];

    const session = await SessionService.createSession(
      userId,
      metadata ? JSON.parse(metadata) : undefined
    );

    const fileMetadata = [];
    const allTexts = [];

    for (const file of files) {
      try {
        const parsed = await DocumentParserService.parseDocument(
          file.path,
          file.originalname,
          file.mimetype
        );

        const tokenEstimate = await TokenEstimatorService.estimateTokens(parsed.text);

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
      }
    }

    const overallEstimate = await TokenEstimatorService.estimateMultipleFiles(allTexts);

    const canProcess =
      overallEstimate.recommendations.length > 0 &&
      !overallEstimate.recommendations.some((r) => r.includes('exceeds'));

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
  }
}
