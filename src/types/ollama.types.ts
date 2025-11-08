/**
 * Ollama Model Types
 * Types for Ollama model management and API responses
 */

/**
 * Ollama model information from API
 * Response format from Ollama /api/tags endpoint
 */
export interface OllamaModelInfo {
  name: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

/**
 * Model update configuration
 */
export interface OllamaModelUpdate {
  displayName?: string;
  isEnabled?: boolean;
  priority?: number;
  maxTokens?: number;
  temperature?: number;
}
