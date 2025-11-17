/**
 * Token estimation and model compatibility types
 */

export interface TokenEstimate {
  tokenCount: number;
  estimatedCost?: number;
  modelCompatibility: ModelCompatibility;
  recommendations: string[];
}

export interface ModelCompatibility {
  [modelName: string]: {
    compatible: boolean;
    maxTokens: number;
    remainingTokens: number;
    percentageUsed: number;
  };
}
