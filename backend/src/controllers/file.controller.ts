/**
 * File Controller
 * Handles file viewing and download operations
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export class FileController {
  /**
   * View/Download File
   * GET /api/wizard/files/:fileId
   */
  static async getFile(req: Request, res: Response): Promise<void> {
    const { fileId } = req.params;
    const { download } = req.query;

    try {
      // Get file from database
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        res.status(404).json({
          success: false,
          error: 'File not found',
        });
        return;
      }

      // Check if file exists on disk
      const filePath = file.path;
      try {
        await fs.access(filePath);
      } catch (error) {
        logger.error(`File not found on disk: ${filePath}`);
        res.status(404).json({
          success: false,
          error: 'File not found on disk',
        });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', file.mimeType);

      if (download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      }

      // Stream the file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error: Error) => {
        logger.error(`Error streaming file ${fileId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error reading file',
          });
        }
      });
    } catch (error) {
      logger.error(`Error serving file ${fileId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
