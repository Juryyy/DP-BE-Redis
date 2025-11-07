import { encoding_for_model, Tiktoken } from 'tiktoken';
import { logger } from '../utils/logger';
import { TokenEstimate, ModelCompatibility } from '../types';
import { MODEL_TOKEN_LIMITS, TOKEN_TO_CHAR_RATIO } from '../constants';

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
      recommendations.push('⚠️ Document exceeds most model limits. Consider splitting into smaller chunks.');
    } else {
      recommendations.push(`✓ Compatible with ${compatibleModels.length} models`);
    }

    // Suggest best models
    if (tokenCount < 8000) {
      recommendations.push('Recommended: GPT-3.5-turbo or Llama 3.1 (cost-effective)');
    } else if (tokenCount < 30000) {
      recommendations.push('Recommended: GPT-4-turbo or Gemini 1.0 Pro');
    } else if (tokenCount < 100000) {
      recommendations.push('Recommended: Claude 3 or Gemini 1.5 Pro (large context)');
    } else {
      recommendations.push('Recommended: Gemini 1.5 Pro (1M token context)');
    }

    // Warning for very large documents
    if (tokenCount > 50000) {
      recommendations.push('⚠️ Large document detected. Processing may take longer and cost more.');
    }

    return recommendations;
  }

  /**
   * Estimate processing cost (approximate, in USD)
   */
  private static estimateCost(tokenCount: number, model: string): number {
    // Approximate pricing per 1M tokens (as of 2024)
    const pricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4-turbo-preview': { input: 10, output: 30 },
      'gpt-4': { input: 30, output: 60 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      'gemini-1.5-pro': { input: 3.5, output: 10.5 },
      'gemini-1.0-pro': { input: 0.5, output: 1.5 },
      'claude-3-opus': { input: 15, output: 75 },
      'claude-3-sonnet': { input: 3, output: 15 },
      'claude-3-haiku': { input: 0.25, output: 1.25 },
    };

    const modelPricing = pricing[model] || { input: 1, output: 2 };

    // Estimate: input tokens + estimated output tokens (assume 20% of input)
    const inputCost = (tokenCount / 1000000) * modelPricing.input;
    const outputCost = (tokenCount * 0.2 / 1000000) * modelPricing.output;

    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Estimate tokens for multiple files
   */
  static async estimateMultipleFiles(texts: string[], model: string = 'gpt-4'): Promise<TokenEstimate> {
    const combinedText = texts.join('\n\n');
    return this.estimateTokens(combinedText, model);
  }

  /**
   * Check if text fits within model limit
   */
  static fitsInModel(tokenCount: number, modelName: string): boolean {
    const limit = MODEL_TOKEN_LIMITS[modelName as keyof typeof MODEL_TOKEN_LIMITS];
    if (!limit) return false;
    return tokenCount <= limit * 0.8; // Use 80% to leave room for response
  }

  /**
   * Get recommended models for token count
   */
  static getRecommendedModels(tokenCount: number): string[] {
    return Object.entries(MODEL_TOKEN_LIMITS)
      .filter(([_, limit]) => tokenCount <= limit * 0.8)
      .map(([name, _]) => name)
      .sort((a, b) => {
        // Sort by cost-effectiveness
        const costA = this.estimateCost(tokenCount, a);
        const costB = this.estimateCost(tokenCount, b);
        return costA - costB;
      });
  }
}
