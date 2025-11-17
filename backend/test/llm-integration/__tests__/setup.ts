// Jest setup for LLM Integration Tests

// Set longer timeout for LLM operations
jest.setTimeout(30000);

// Mock environment variables if not set
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-api-key';
}

if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = 'test-api-key';
}

if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test-api-key';
}

if (!process.env.OLLAMA_BASE_URL) {
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
}

if (!process.env.OLLAMA_REMOTE_URL) {
  process.env.OLLAMA_REMOTE_URL = 'http://localhost:11435';
}

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export {};
