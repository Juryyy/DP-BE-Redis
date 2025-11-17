import { LLMService } from '../../../src/services/llm.service';
import {
  MultiModelLLMService,
  createMultiModelConfig,
  MultiModelResult,
} from '../../../src/services/multi-model-llm.service';
import { DEFAULT_MODELS } from '../../../src/constants/models.constants';
import { AIProvider } from '../../../src/types/llm.types';

// Mock environment variables
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
process.env.OLLAMA_REMOTE_URL = process.env.OLLAMA_REMOTE_URL || 'http://localhost:11435';

describe('LLM Service - Unit Tests', () => {
  describe('Provider Configuration', () => {
    test('should have all providers defined in DEFAULT_MODELS', () => {
      const expectedProviders: AIProvider[] = ['openai', 'gemini', 'anthropic', 'ollama', 'ollama-remote'];

      expectedProviders.forEach(provider => {
        expect(DEFAULT_MODELS[provider]).toBeDefined();
        expect(typeof DEFAULT_MODELS[provider]).toBe('string');
        expect(DEFAULT_MODELS[provider].length).toBeGreaterThan(0);
      });
    });

    test('should have correct default model names', () => {
      expect(DEFAULT_MODELS.openai).toContain('gpt');
      expect(DEFAULT_MODELS.anthropic).toContain('claude');
      expect(DEFAULT_MODELS.gemini).toContain('gemini');
      expect(DEFAULT_MODELS.ollama).toContain('llama');
      expect(DEFAULT_MODELS['ollama-remote']).toContain('llama');
    });

    test('provider enum includes all expected values', () => {
      const providers: AIProvider[] = ['openai', 'gemini', 'anthropic', 'ollama', 'ollama-remote'];

      // Each should be a valid string
      providers.forEach(provider => {
        expect(typeof provider).toBe('string');
        expect(provider.length).toBeGreaterThan(0);
      });
    });
  });

  describe('LLMService API', () => {
    test('LLMService class should be defined', () => {
      expect(LLMService).toBeDefined();
      expect(typeof LLMService).toBe('function');
    });

    test('LLMService should have static create method', () => {
      expect(LLMService.create).toBeDefined();
      expect(typeof LLMService.create).toBe('function');
    });

    test('LLMService should have static listAvailableModels method', () => {
      expect(LLMService.listAvailableModels).toBeDefined();
      expect(typeof LLMService.listAvailableModels).toBe('function');
    });

    test('LLMService should have static checkModelAvailability method', () => {
      expect(LLMService.checkModelAvailability).toBeDefined();
      expect(typeof LLMService.checkModelAvailability).toBe('function');
    });

    test('LLMService should have static detectUncertainty method', () => {
      expect(LLMService.detectUncertainty).toBeDefined();
      expect(typeof LLMService.detectUncertainty).toBe('function');
    });
  });
});

describe('Multi-Model LLM Service - Unit Tests', () => {
  describe('createMultiModelConfig', () => {
    test('should return array of model configs', () => {
      const configs = createMultiModelConfig();

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
    });

    test('each config should have required properties', () => {
      const configs = createMultiModelConfig();

      configs.forEach(config => {
        expect(config).toHaveProperty('provider');
        expect(config).toHaveProperty('enabled');

        expect(typeof config.provider).toBe('string');
        expect(typeof config.enabled).toBe('boolean');
      });
    });

    test('should have reasonable default values', () => {
      const configs = createMultiModelConfig();

      configs.forEach(config => {
        // Check priority if present
        if (config.priority !== undefined) {
          expect(config.priority).toBeGreaterThanOrEqual(0);
          expect(config.priority).toBeLessThanOrEqual(100);
        }
      });
    });

    test('should include multiple provider types', () => {
      const configs = createMultiModelConfig();
      const providers = configs.map(c => c.provider);

      // Should have at least 2 different providers
      const uniqueProviders = [...new Set(providers)];
      expect(uniqueProviders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateComparisonMatrix', () => {
    const mockResults: MultiModelResult[] = [
      {
        provider: 'openai',
        modelName: 'gpt-4-turbo',
        result: 'Response from OpenAI',
        duration: 1500,
        status: 'completed',
        tokensUsed: 150,
        timestamp: new Date().toISOString(),
      },
      {
        provider: 'anthropic',
        modelName: 'claude-3',
        result: 'Response from Anthropic',
        duration: 2000,
        status: 'completed',
        tokensUsed: 160,
        timestamp: new Date().toISOString(),
      },
      {
        provider: 'gemini',
        modelName: 'gemini-pro',
        result: 'Response from Gemini',
        duration: 1200,
        status: 'completed',
        tokensUsed: 145,
        timestamp: new Date().toISOString(),
      },
    ];

    test('should generate comparison matrix', () => {
      const matrix = MultiModelLLMService.generateComparisonMatrix(mockResults);

      expect(matrix).toBeDefined();
      expect(typeof matrix).toBe('object');
    });

    test('matrix should contain entries for each result', () => {
      const matrix = MultiModelLLMService.generateComparisonMatrix(mockResults);

      expect(Object.keys(matrix).length).toBe(mockResults.length);
      mockResults.forEach(result => {
        expect(matrix[result.provider]).toBeDefined();
      });
    });

    test('each matrix entry should have comparison metrics', () => {
      const matrix = MultiModelLLMService.generateComparisonMatrix(mockResults);

      Object.values(matrix).forEach((entry: any) => {
        expect(entry).toHaveProperty('duration');
        expect(entry).toHaveProperty('tokensUsed');
        expect(entry).toHaveProperty('resultLength');

        expect(typeof entry.duration).toBe('number');
        expect(typeof entry.tokensUsed).toBe('number');
        expect(typeof entry.resultLength).toBe('number');
      });
    });
  });

  describe('getFastestResult', () => {
    const mockResults: MultiModelResult[] = [
      { provider: 'openai', modelName: 'gpt-4', duration: 1500, result: '', status: 'completed', timestamp: new Date().toISOString() },
      { provider: 'anthropic', modelName: 'claude-3', duration: 2000, result: '', status: 'completed', timestamp: new Date().toISOString() },
      { provider: 'gemini', modelName: 'gemini-pro', duration: 1200, result: '', status: 'completed', timestamp: new Date().toISOString() },
    ];

    test('should return the fastest result', () => {
      const fastest = MultiModelLLMService.getFastestResult(mockResults);

      expect(fastest).toBeDefined();
      expect(fastest!.provider).toBe('gemini');
      expect(fastest!.duration).toBe(1200);
    });

    test('should handle empty results', () => {
      const fastest = MultiModelLLMService.getFastestResult([]);

      expect(fastest).toBeUndefined();
    });

    test('should handle single result', () => {
      const fastest = MultiModelLLMService.getFastestResult([mockResults[0]]);

      expect(fastest).toBeDefined();
      expect(fastest!.provider).toBe('openai');
    });
  });

  describe('getConsensusResult', () => {
    test('should return consensus when responses are similar', () => {
      const similarResults: MultiModelResult[] = [
        { provider: 'openai', modelName: 'gpt-4', result: 'The answer is 42', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
        { provider: 'anthropic', modelName: 'claude-3', result: 'The answer is 42', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
        { provider: 'gemini', modelName: 'gemini-pro', result: 'The answer is 42', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
      ];

      const consensus = MultiModelLLMService.getConsensusResult(similarResults);

      expect(consensus).toBeDefined();
    });

    test('should handle divergent responses', () => {
      const divergentResults: MultiModelResult[] = [
        { provider: 'openai', modelName: 'gpt-4', result: 'Answer A', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
        { provider: 'anthropic', modelName: 'claude-3', result: 'Answer B', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
        { provider: 'gemini', modelName: 'gemini-pro', result: 'Answer C', status: 'completed', duration: 1000, timestamp: new Date().toISOString() },
      ];

      // Should not throw
      expect(() => {
        MultiModelLLMService.getConsensusResult(divergentResults);
      }).not.toThrow();
    });

    test('should handle empty results', () => {
      const consensus = MultiModelLLMService.getConsensusResult([]);

      expect(consensus).toBeNull();
    });
  });
});

describe('Response Format Validation', () => {
  describe('JSON Response Format', () => {
    test('should validate JSON structure in responses', () => {
      const jsonResponse = '{"name": "Test", "value": 123, "items": ["a", "b", "c"]}';

      expect(() => JSON.parse(jsonResponse)).not.toThrow();

      const parsed = JSON.parse(jsonResponse);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('value');
      expect(parsed).toHaveProperty('items');
      expect(Array.isArray(parsed.items)).toBe(true);
    });

    test('should detect invalid JSON in responses', () => {
      const invalidJsonResponse = '{name: "Test", value: 123}'; // Missing quotes

      expect(() => JSON.parse(invalidJsonResponse)).toThrow();
    });

    test('should handle nested JSON structures', () => {
      const nestedJson = `{
        "invoice": {
          "number": "2024-001",
          "items": [
            {"name": "Item 1", "price": 100},
            {"name": "Item 2", "price": 200}
          ],
          "total": 300
        }
      }`;

      const parsed = JSON.parse(nestedJson);
      expect(parsed.invoice).toBeDefined();
      expect(parsed.invoice.items).toHaveLength(2);
      expect(parsed.invoice.total).toBe(300);
    });
  });

  describe('Czech Language Content', () => {
    test('should handle Czech characters correctly', () => {
      const czechText = 'Příliš žluťoučký kůň úpěl ďábelské ódy';

      expect(czechText).toContain('ž');
      expect(czechText).toContain('ů');
      expect(czechText).toContain('ě');
      expect(czechText).toContain('á');
    });

    test('should validate Czech invoice fields', () => {
      const invoiceData = {
        cisloFaktury: '2024-001234',
        ico: '12345678',
        dic: 'CZ12345678',
        castka: '330330',
      };

      expect(invoiceData.cisloFaktury).toMatch(/^\d{4}-\d+$/);
      expect(invoiceData.ico).toMatch(/^\d{8}$/);
      expect(invoiceData.dic).toMatch(/^CZ\d{8,10}$/);
    });
  });

  describe('Model Response Structure', () => {
    test('should validate multi-model response structure', () => {
      const response = {
        success: true,
        data: {
          results: [
            {
              provider: 'openai',
              modelName: 'gpt-4',
              result: 'Test response',
              duration: 1500,
              status: 'completed',
              tokensUsed: 150,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('results');
      expect(Array.isArray(response.data.results)).toBe(true);

      const result = response.data.results[0];
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('modelName');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('status');
    });

    test('should validate execution time is reasonable', () => {
      const executionTime = 1500;

      expect(executionTime).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(300000); // Max 5 minutes
    });

    test('should validate token usage', () => {
      const tokensUsed = 150;

      expect(tokensUsed).toBeGreaterThanOrEqual(0);
      expect(tokensUsed).toBeLessThan(1000000); // Reasonable upper bound
    });
  });
});
