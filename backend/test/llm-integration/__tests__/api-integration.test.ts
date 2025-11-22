import request from 'supertest';
import express from 'express';
import { MultiModelController } from '../../../src/controllers/multi-model.controller';
import { AdminController } from '../../../src/controllers/admin.controller';

// Mock the services to avoid actual API calls
jest.mock('../../../src/services/multi-model-llm.service', () => ({
  MultiModelLLMService: {
    executeMultiModel: jest.fn().mockResolvedValue({
      results: [
        {
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          content: 'Mock response from OpenAI',
          executionTime: 1500,
          status: 'success',
          tokenUsage: { prompt: 100, completion: 50, total: 150 },
        },
      ],
    }),
    generateComparisonMatrix: jest.fn().mockReturnValue({
      openai: { executionTime: 1500, tokenUsage: 150, responseLength: 28 },
    }),
    getFastestResult: jest.fn().mockReturnValue({
      provider: 'openai',
      executionTime: 1500,
    }),
    getConsensusResult: jest.fn().mockReturnValue(null),
  },
  createMultiModelConfig: jest.fn().mockReturnValue([
    { provider: 'openai', model: 'gpt-4-turbo-preview', enabled: true },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', enabled: true },
  ]),
}));

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Multi-model routes
  app.post('/api/wizard/multi-model/execute', async (req, res) => {
    try {
      await MultiModelController.execute(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  app.post('/api/wizard/multi-model/compare', async (req, res) => {
    try {
      await MultiModelController.compare(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  app.get('/api/wizard/multi-model/config', async (req, res) => {
    try {
      await MultiModelController.getConfig(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  app.post('/api/wizard/multi-model/config', async (req, res) => {
    try {
      await MultiModelController.updateConfig(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return app;
};

describe('Multi-Model API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/wizard/multi-model/execute', () => {
    test('should execute prompt with valid request', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/execute')
        .send({
          prompt: 'Test prompt',
          models: [{ provider: 'openai', enabled: true }],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('results');
    });

    test('should return 400 when prompt is missing', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/execute')
        .send({
          models: [{ provider: 'openai', enabled: true }],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('response should have correct structure', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/execute')
        .send({
          prompt: 'Test prompt',
        });

      expect(response.body.data.results).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);

      const result = response.body.data.results[0];
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('status');
    });

    test('should handle custom system prompt', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/execute')
        .send({
          prompt: 'Test prompt',
          systemPrompt: 'Custom system prompt in Czech',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/wizard/multi-model/compare', () => {
    test('should compare results successfully', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/compare')
        .send({
          results: [
            {
              provider: 'openai',
              executionTime: 1500,
              status: 'success',
              tokenUsage: { total: 150 },
            },
            {
              provider: 'anthropic',
              executionTime: 2000,
              status: 'success',
              tokenUsage: { total: 160 },
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('comparisonMatrix');
      expect(response.body.data).toHaveProperty('fastestResult');
      expect(response.body.data).toHaveProperty('consensusResult');
    });

    test('should return 400 when results array is missing', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/compare')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should return 400 when results is not an array', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/compare')
        .send({
          results: 'not an array',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/wizard/multi-model/config', () => {
    test('should return configuration', async () => {
      const response = await request(app).get('/api/wizard/multi-model/config');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('models');
      expect(Array.isArray(response.body.data.models)).toBe(true);
    });

    test('should include enabled count', async () => {
      const response = await request(app).get('/api/wizard/multi-model/config');

      expect(response.body.data).toHaveProperty('enabledCount');
      expect(typeof response.body.data.enabledCount).toBe('number');
    });
  });

  describe('POST /api/wizard/multi-model/config', () => {
    test('should validate configuration update', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/config')
        .send({
          models: [
            { provider: 'openai', enabled: true },
            { provider: 'anthropic', enabled: false },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    test('should return 400 when models is missing', async () => {
      const response = await request(app).post('/api/wizard/multi-model/config').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    test('should return 400 when model has no provider', async () => {
      const response = await request(app)
        .post('/api/wizard/multi-model/config')
        .send({
          models: [{ enabled: true }],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});

describe('Response Format Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  test('all responses should be JSON', async () => {
    const response = await request(app)
      .post('/api/wizard/multi-model/execute')
      .send({ prompt: 'test' });

    expect(response.headers['content-type']).toMatch(/json/);
  });

  test('error responses should have consistent structure', async () => {
    const response = await request(app).post('/api/wizard/multi-model/execute').send({});

    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('error');
    expect(response.body.success).toBe(false);
  });

  test('success responses should have consistent structure', async () => {
    const response = await request(app)
      .post('/api/wizard/multi-model/execute')
      .send({ prompt: 'test' });

    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(response.body.success).toBe(true);
  });
});
