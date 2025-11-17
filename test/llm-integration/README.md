# LLM Integration Test Suite

Comprehensive test suite for testing LLM API integrations (OpenAI, Anthropic Claude, Google Gemini, Ollama local/remote).

## Prerequisites

1. **Environment Setup**
   - Ensure `.env` file has all required API keys:
     ```
     OPENAI_API_KEY=your_key
     ANTHROPIC_API_KEY=your_key
     GEMINI_API_KEY=your_key
     OLLAMA_BASE_URL=http://localhost:11434
     OLLAMA_REMOTE_URL=https://your-ngrok-url.ngrok.io (optional)
     ```

2. **Start the API Server**
   ```bash
   npm run dev
   ```

3. **Required Tools**
   - `curl` - for API requests
   - `jq` - for JSON processing
   - `bc` - for time calculations

## Directory Structure

```
test/llm-integration/
├── samples/                          # Sample documents for testing
│   ├── invoice-czech.pdf            # Multi-page Czech invoice (PDF)
│   ├── technical-report.xlsx        # Technical analysis report (Excel)
│   ├── meeting-notes.docx           # Sprint planning meeting notes (Word)
│   └── *.txt                         # Text versions (backup)
├── single-model/                     # Single-model test cases
│   ├── test-01-invoice-extraction.json
│   ├── test-02-technical-analysis.json
│   └── test-03-meeting-summarization.json
├── multi-model/                      # Multi-model comparison tests
│   ├── test-01-invoice-comparison.json
│   ├── test-02-technical-summary.json
│   └── test-03-action-items-extraction.json
├── scripts/                          # Helper scripts
│   └── generate-documents.ts        # Generate sample PDF/Excel/Word files
├── results/                          # Test results (auto-created)
├── run-tests.sh                      # Test runner script
└── README.md                         # This file
```

### Regenerating Sample Documents

If you need to regenerate the sample documents:

```bash
npx ts-node test/llm-integration/scripts/generate-documents.ts
```

This creates professional multi-page documents with tables, formatting, and real content.

## Running Tests

### Quick Start

```bash
cd test/llm-integration

# Check API health
./run-tests.sh health

# Quick test all providers
./run-tests.sh quick

# Run all tests
./run-tests.sh all
```

### Single-Model Tests

Test one provider/model at a time:

```bash
# Run specific test
./run-tests.sh single ./single-model/test-01-invoice-extraction.json

# Run all single-model tests
./run-tests.sh all-single
```

**Test Cases:**
1. **Invoice Extraction** - Extract structured data from Czech invoice (OpenAI)
2. **Technical Analysis** - Analyze technical report for issues (Anthropic Claude)
3. **Meeting Summarization** - Summarize meeting notes and extract action items (Gemini)

Each test case includes alternative providers you can switch to.

### Multi-Model Tests

Compare multiple models on the same task:

```bash
# Run specific comparison test
./run-tests.sh multi ./multi-model/test-01-invoice-comparison.json

# Run all multi-model tests
./run-tests.sh all-multi
```

**Test Cases:**
1. **Invoice Comparison** - Compare all providers extracting invoice data
2. **Technical Summary** - Compare models analyzing technical report
3. **Action Items Extraction** - Compare models extracting meeting action items

### Direct Provider Testing

Test specific providers directly:

```bash
# Test OpenAI
./run-tests.sh test-provider openai "Řekni ahoj v češtině"

# Test Anthropic Claude
./run-tests.sh test-provider anthropic "Co je to TypeScript?"

# Test Google Gemini
./run-tests.sh test-provider gemini "Vysvětli REST API"

# Test local Ollama
./run-tests.sh test-provider ollama "Jak funguje Git?"

# Test remote Ollama (if configured)
./run-tests.sh test-provider ollama-remote "Co je Docker?"
```

## Test Configuration

### Single-Model Test JSON Schema

```json
{
  "testId": "SINGLE-01",
  "testName": "Test Name",
  "description": "Test description",
  "sampleFile": "../samples/sample.txt",
  "provider": "openai",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.1,
  "maxTokens": 2000,
  "prompts": [
    {
      "content": "Your prompt here",
      "priority": 1,
      "targetType": "FULL_DOCUMENT"
    }
  ],
  "expectedOutput": {
    "type": "json",
    "requiredFields": ["field1", "field2"]
  },
  "alternativeProviders": [
    {
      "provider": "gemini",
      "model": "gemini-1.5-pro"
    }
  ]
}
```

### Multi-Model Test JSON Schema

```json
{
  "testId": "MULTI-01",
  "testName": "Comparison Test Name",
  "description": "Test description",
  "sampleFile": "../samples/sample.txt",
  "prompt": "Your prompt here",
  "systemPrompt": "System prompt for all models",
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4-turbo-preview",
      "temperature": 0.1,
      "maxTokens": 2000,
      "enabled": true
    },
    {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.1,
      "maxTokens": 2000,
      "enabled": true
    }
  ],
  "comparisonCriteria": {
    "accuracy": "Description",
    "responseTime": "Time measurement"
  }
}
```

## Results

Test results are saved in the `results/` directory with timestamps:

- **Single-model results**: `single_<provider>_<timestamp>.json`
- **Multi-model results**: `multi_<testId>_<timestamp>.json`
- **Comparison results**: `multi_<testId>_compare_<timestamp>.json`

### Result Structure

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "provider": "openai",
        "model": "gpt-4-turbo-preview",
        "content": "Model response...",
        "executionTime": 1234,
        "status": "success",
        "tokenUsage": {
          "prompt": 500,
          "completion": 200,
          "total": 700
        }
      }
    ]
  },
  "testName": "Test Name",
  "totalElapsedTime": "5.123"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3000/api` | Base URL for API |
| `VERBOSE` | `false` | Show verbose output |

Example:
```bash
VERBOSE=true API_BASE_URL=http://localhost:3001/api ./run-tests.sh all
```

## Sample Documents

### 1. Czech Invoice (invoice-czech.pdf)
Multi-page PDF invoice with:
- Company information (IČO, DIČ)
- Line items with prices
- VAT calculation
- Banking details
- Payment terms and service description

### 2. Technical Report (technical-report.xlsx)
Excel workbook with multiple sheets:
- Summary metrics sheet
- API response times data
- Issues and priorities
- Recommendations table

### 3. Meeting Notes (meeting-notes.docx)
Word document with formatted content:
- Attendees and agenda
- User story planning tables
- Action items with owners and deadlines
- Technical debt discussion
- Professional formatting with headers and tables

## Jest Unit/Integration Tests

The test suite includes comprehensive Jest tests:

### Running Jest Tests

```bash
# Run all LLM integration tests
npm test -- test/llm-integration/__tests__/

# Run specific test file
npm test -- test/llm-integration/__tests__/document-parsing.test.ts

# Run with coverage
npm test -- --coverage test/llm-integration/__tests__/
```

### Test Categories

1. **Document Parsing Tests** (`document-parsing.test.ts`)
   - File existence and format validation
   - Magic bytes verification (PDF, XLSX, DOCX)
   - Test case configuration validation
   - Prompt content validation

2. **LLM Service Tests** (`llm-service.test.ts`)
   - Provider configuration validation
   - Multi-model config validation
   - Response format validation
   - Czech language content handling
   - JSON structure validation

3. **API Integration Tests** (`api-integration.test.ts`)
   - Multi-model API endpoint testing
   - Request/response structure validation
   - Error handling verification

### Prerequisites for Jest Tests

```bash
# Generate Prisma client (required for some tests)
npx prisma generate

# Ensure all dependencies are installed
npm install
```

## Troubleshooting

### API Connection Issues
```bash
# Check if API is running
curl http://localhost:3000/api/admin/ollama/health

# Check multi-model config
./run-tests.sh config
```

### Provider-Specific Issues

**OpenAI:**
- Verify `OPENAI_API_KEY` in `.env`
- Check API quota/billing

**Anthropic:**
- Verify `ANTHROPIC_API_KEY` in `.env`
- Check rate limits

**Gemini:**
- Verify `GEMINI_API_KEY` in `.env`
- Check region availability

**Ollama (local):**
- Ensure Ollama is running: `ollama serve`
- Pull models: `ollama pull llama3.1:8b`
- Check: `curl http://localhost:11434/api/tags`

**Ollama (remote):**
- Configure `OLLAMA_REMOTE_URL` in `.env`
- For ngrok URLs, the API automatically bypasses the interstitial page
- Verify connectivity: `curl -H "ngrok-skip-browser-warning: true" <remote_url>/api/tags`

## Adding New Tests

1. Create sample file in `samples/`
2. Create test case JSON in `single-model/` or `multi-model/`
3. Run with `./run-tests.sh single <test_file>` or `./run-tests.sh multi <test_file>`

## Notes

- All tests use Czech language prompts and documents
- Results include execution time and token usage
- Multi-model tests automatically generate comparison matrices
- ngrok interstitial page bypass is handled automatically for remote Ollama
