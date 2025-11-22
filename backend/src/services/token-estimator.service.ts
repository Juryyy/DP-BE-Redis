import { encoding_for_model, Tiktoken } from 'tiktoken';
import { logger } from '../utils/logger';
import { TokenEstimate, ModelCompatibility } from '../types';
import {
  MODEL_TOKEN_LIMITS,
  TOKEN_TO_CHAR_RATIO,
  MODEL_PRICING,
  DEFAULT_MODEL_PRICING,
  OUTPUT_TOKEN_RATIO,
  TOKEN_THRESHOLDS,
  MODEL_RECOMMENDATIONS,
  TOKEN_MESSAGES,
  MODEL_SAFETY_BUFFER,
} from '../constants';

// Re-export for backward compatibility
export { TokenEstimate, ModelCompatibility };

export class TokenEstimatorService {
  private static encoders: Map<string, Tiktoken> = new Map();

  /**
   * Estimate tokens for text using tiktoken (GPT tokenizer)
   */
  static async estimateTokens(text: string, model: string = 'gpt-4'): Promise<TokenEstimate> {
    try {
      let tokenCount: number;

      // Use tiktoken for OpenAI models
      if (model.startsWith('gpt-')) {
        const encoder = this.getEncoder(model as any);
        const tokens = encoder.encode(text);
        tokenCount = tokens.length;
      } else {
        // Fallback: rough estimation based on character count
        tokenCount = Math.ceil(text.length / TOKEN_TO_CHAR_RATIO);
      }

      // Calculate model compatibility
      const modelCompatibility = this.calculateModelCompatibility(tokenCount);

      // Generate recommendations
      const recommendations = this.generateRecommendations(tokenCount, modelCompatibility);

      // Estimate cost (approximate)
      const estimatedCost = this.estimateCost(tokenCount, model);

      return {
        tokenCount,
        estimatedCost,
        modelCompatibility,
        recommendations,
      };
    } catch (error) {
      logger.error('Error estimating tokens:', error);

      // Fallback to character-based estimation
      const tokenCount = Math.ceil(text.length / 4);
      const modelCompatibility = this.calculateModelCompatibility(tokenCount);

      return {
        tokenCount,
        modelCompatibility,
        recommendations: ['Using fallback token estimation'],
      };
    }
  }

  /**
   * Get or create encoder for model
   */
  private static getEncoder(model: string): Tiktoken {
    if (!this.encoders.has(model)) {
      try {
        const encoder = encoding_for_model(model as any);
        this.encoders.set(model, encoder);
      } catch {
        // Fallback to cl100k_base for unknown models
        const encoder = encoding_for_model('gpt-4');
        this.encoders.set(model, encoder);
      }
    }
    return this.encoders.get(model)!;
  }

  /**
   * Calculate compatibility with various models
   */
  private static calculateModelCompatibility(tokenCount: number): ModelCompatibility {
    const compatibility: ModelCompatibility = {};

    for (const [modelName, maxTokens] of Object.entries(MODEL_TOKEN_LIMITS)) {
      const remainingTokens = maxTokens - tokenCount;
      const percentageUsed = (tokenCount / maxTokens) * 100;

      compatibility[modelName] = {
        compatible: tokenCount <= maxTokens * 0.8, // Leave 20% buffer for response
        maxTokens,
        remainingTokens,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
      };
    }

    return compatibility;
  }

  /**
   * Generate recommendations based on token count
   */
  private static generateRecommendations(
    tokenCount: number,
    modelCompatibility: ModelCompatibility
  ): string[] {
    const recommendations: string[] = [];

    // Find compatible models
    const compatibleModels = Object.entries(modelCompatibility)
      .filter(([_, info]) => info.compatible)
      .map(([name, _]) => name);

    if (compatibleModels.length === 0) {
      recommendations.push(TOKEN_MESSAGES.exceedsLimits);
    } else {
      recommendations.push(TOKEN_MESSAGES.compatible(compatibleModels.length));
    }

    // Suggest best models based on token thresholds
    if (tokenCount < TOKEN_THRESHOLDS.small) {
      recommendations.push(`Recommended: ${MODEL_RECOMMENDATIONS.small}`);
    } else if (tokenCount < TOKEN_THRESHOLDS.medium) {
      recommendations.push(`Recommended: ${MODEL_RECOMMENDATIONS.medium}`);
    } else if (tokenCount < TOKEN_THRESHOLDS.large) {
      recommendations.push(`Recommended: ${MODEL_RECOMMENDATIONS.large}`);
    } else {
      recommendations.push(`Recommended: ${MODEL_RECOMMENDATIONS.veryLarge}`);
    }

    // Warning for very large documents
    if (tokenCount > TOKEN_THRESHOLDS.veryLarge) {
      recommendations.push(TOKEN_MESSAGES.largeDocument);
    }

    return recommendations;
  }

  /**
   * Estimate processing cost (approximate, in USD)
   */
  private static estimateCost(tokenCount: number, model: string): number {
    const modelPricing =
      MODEL_PRICING[model as keyof typeof MODEL_PRICING] || DEFAULT_MODEL_PRICING;

    // Estimate: input tokens + estimated output tokens
    const inputCost = (tokenCount / 1000000) * modelPricing.input;
    const outputCost = ((tokenCount * OUTPUT_TOKEN_RATIO) / 1000000) * modelPricing.output;

    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Estimate tokens for multiple files
   */
  static async estimateMultipleFiles(
    texts: string[],
    model: string = 'gpt-4'
  ): Promise<TokenEstimate> {
    const combinedText = texts.join('\n\n');
    return this.estimateTokens(combinedText, model);
  }

  /**
   * Check if text fits within model limit
   */
  static fitsInModel(tokenCount: number, modelName: string): boolean {
    const limit = MODEL_TOKEN_LIMITS[modelName as keyof typeof MODEL_TOKEN_LIMITS];
    if (!limit) return false;
    return tokenCount <= limit * MODEL_SAFETY_BUFFER;
  }

  /**
   * Get recommended models for token count
   */
  static getRecommendedModels(tokenCount: number): string[] {
    return Object.entries(MODEL_TOKEN_LIMITS)
      .filter(([_, limit]) => tokenCount <= limit * MODEL_SAFETY_BUFFER)
      .map(([name, _]) => name)
      .sort((a, b) => {
        // Sort by cost-effectiveness
        const costA = this.estimateCost(tokenCount, a);
        const costB = this.estimateCost(tokenCount, b);
        return costA - costB;
      });
  }
}
