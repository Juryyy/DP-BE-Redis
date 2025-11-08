/**
 * Result Controller
 * Handles result retrieval, confirmation, and modification
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { PromptStatus, ResultStatus, SessionStatus } from '@prisma/client';
import { SessionService } from '../services/session.service';
import * as diff from 'diff';

export class ResultController {
  /**
   * STEP 5: Get Result
   * GET /api/wizard/result/:sessionId
   */
  static async getResult(req: Request, res: Response): Promise<void> {
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
        res.status(404).json({ error: 'No results available yet' });
        return;
      }

      // Combine results
      const combinedResult = prompts
        .map(p => `## ${p.content}\n\n${p.result || ''}`)
        .join('\n\n---\n\n');

      // Create initial result
      result = await prisma.result.create({
        data: {
          sessionId,
          version: 1,
          content: combinedResult,
          status: ResultStatus.PENDING_CONFIRMATION,
          metadata: {
            promptCount: prompts.length,
          },
        },
      });
    }

    // Get all versions for comparison
    const allVersions = await prisma.result.findMany({
      where: { sessionId },
      orderBy: { version: 'asc' },
      select: { version: true, createdAt: true, status: true },
    });

    res.json({
      success: true,
      data: {
        sessionId,
        result: {
          id: result.id,
          version: result.version,
          content: result.content,
          status: result.status,
          createdAt: result.createdAt,
        },
        versions: allVersions,
        canConfirm: result.status === ResultStatus.PENDING_CONFIRMATION,
      },
    });
  }

  /**
   * STEP 6: Confirm Result
   * POST /api/wizard/result/confirm
   */
  static async confirmResult(req: Request, res: Response): Promise<void> {
    const { sessionId, resultId } = req.body;

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        status: ResultStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    // Update session status
    await SessionService.updateSessionStatus(sessionId, SessionStatus.COMPLETED);

    res.json({
      success: true,
      data: {
        sessionId,
        result: {
          id: result.id,
          version: result.version,
          status: result.status,
          confirmedAt: result.confirmedAt,
        },
      },
    });
  }

  /**
   * STEP 6: Modify Result
   * POST /api/wizard/result/modify
   */
  static async modifyResult(req: Request, res: Response): Promise<void> {
    const { sessionId, resultId, modificationPrompt, regenerate } = req.body;

    const currentResult = await prisma.result.findUnique({
      where: { id: resultId },
    });

    if (!currentResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    let newContent: string;
    const newVersion = currentResult.version + 1;

    if (regenerate) {
      // Regenerate from prompts
      const prompts = await prisma.prompt.findMany({
        where: { sessionId, status: PromptStatus.COMPLETED },
        orderBy: { priority: 'asc' },
      });

      newContent = prompts
        .map(p => `## ${p.content}\n\n${p.result || ''}`)
        .join('\n\n---\n\n');
    } else {
      // Apply modification prompt
      newContent = `${currentResult.content}\n\n---\n\n### Modifications\n${modificationPrompt}`;
    }

    // Create new version
    const newResult = await prisma.result.create({
      data: {
        sessionId,
        version: newVersion,
        content: newContent,
        status: ResultStatus.MODIFIED,
        metadata: {
          modificationPrompt: regenerate ? 'regenerated' : modificationPrompt,
          previousVersion: currentResult.version,
        },
      },
    });

    // Calculate diff
    const changes = diff.diffLines(currentResult.content, newContent);

    res.json({
      success: true,
      data: {
        sessionId,
        result: {
          id: newResult.id,
          version: newResult.version,
          content: newResult.content,
          status: newResult.status,
          createdAt: newResult.createdAt,
        },
        diff: {
          previousVersion: currentResult.version,
          newVersion,
          changes: changes.map(change => ({
            added: change.added,
            removed: change.removed,
            value: change.value,
          })),
        },
      },
    });
  }
}
