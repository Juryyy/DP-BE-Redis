# DP-BE-Redis - Document Processing Backend with AI Wizard Flow

A powerful document processing system with AI-powered wizard workflow, supporting multiple LLM providers (Ollama, OpenAI, Gemini) with Redis caching and conversation persistence.

## 🌟 Features

### Complete 6-Step Wizard Flow

1. **Upload Files** - Multiple PDF, DOCX, XLSX uploads with text extraction and structure preservation
2. **Submit Prompts** - Priority-based prompts with flexible targeting (file, line, section, global)
3. **AI Processing** - Automated processing with context accumulation and priority queue
4. **Clarification** - Iterative AI conversations for uncertainty resolution
5. **Confirmation** - Review, confirm, modify, or regenerate results
6. **Modification** - Version control with diff comparison

### Key Capabilities

- 📄 **Multi-format Support**: PDF, DOCX, XLSX with structure preservation
- 🤖 **Multiple AI Providers**: Ollama (local/remote), OpenAI, Google Gemini
- 🔄 **Conversation Memory**: Hybrid Redis + PostgreSQL persistence
- 📊 **Token Estimation**: Pre-flight token counting and model compatibility checks
- 🎯 **Smart Targeting**: File-specific, line-specific, section-specific, or global prompts
- 📈 **Priority Queue**: Lower priority number = executes first
- 💬 **Clarification Flow**: AI asks questions when uncertain
- 📝 **Markdown Output**: Structured output with Czech language support
- 🔍 **Version Control**: Track document modifications with diff comparison
- ⚡ **Redis Caching**: Fast session and conversation access
- 🐳 **Docker Ready**: Easy deployment with Docker Compose
- 📚 **Swagger/OpenAPI**: Interactive API documentation with live testing

## 🏗️ Architecture

```
┌─────────────┐
│   Client    │ (Vue.js/Quasar Frontend - not included)
└──────┬──────┘
       │
┌──────▼──────────────────────────────────┐
│         Express API Server               │
│  ┌────────────────────────────────────┐ │
│  │    Wizard Routes (6 Steps)         │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Services Layer                    │ │
│  │  • Session Management              │ │
│  │  • Document Parser (PDF/DOCX/XLSX) │ │
│  │  • LLM Service (LangChain)         │ │
│  │  • Token Estimator                 │ │
│  │  • Processing Queue                │ │
│  │  • Conversation Manager            │ │
│  └────────────────────────────────────┘ │
└──────┬────────────┬─────────────────────┘
       │            │
┌──────▼──────┐ ┌──▼──────────────┐
│    Redis    │ │   PostgreSQL     │
│  (Active)   │ │  (Persistence)   │
│  • Sessions │ │  • Sessions      │
│  • Queue    │ │  • Files         │
│  • Cache    │ │  • Prompts       │
└─────────────┘ │  • Conversations │
                │  • Results       │
                └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 12+
- Redis 6+
- Ollama (optional, for local AI) or API keys for OpenAI/Gemini

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd DP-BE-Redis
```

2. **Install dependencies**
```bash
npm install
```

> **Note:** If you encounter dependency resolution errors, the project includes a `.npmrc` file that handles peer dependency conflicts. If issues persist, you can manually run:
> ```bash
> npm install --legacy-peer-deps
> ```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Start Redis** (if not running)
```bash
redis-server
```

6. **Start Ollama** (optional, for local AI)
```bash
ollama serve
ollama pull llama3.1:8b
```

7. **Run the development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

### Interactive Swagger Documentation

Once the server is running, you can access the interactive API documentation:

**Swagger UI:** `http://localhost:3000/api-docs`

The Swagger documentation provides:
- 📖 Complete API reference with all endpoints
- 🧪 Interactive testing - try API calls directly from the browser
- 📋 Request/response examples for all endpoints
- 🔍 Schema definitions and validation rules
- 💡 Usage examples and descriptions

### Additional Documentation Formats

- **JSON Format:** `http://localhost:3000/api-docs.json`
- **YAML Format:** `http://localhost:3000/api-docs.yaml`
- **Markdown Guide:** See [API.md](API.md) for detailed examples
- **Setup Guide:** See [SETUP.md](SETUP.md) for installation instructions
- **Usage Examples:** See [EXAMPLE.md](EXAMPLE.md) for complete workflow examples

## 🐳 Docker Setup

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

This will start:
- API server (port 3000)
- PostgreSQL (port 5432)
- Redis (port 6379)

### Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/document_processor

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Providers
DEFAULT_AI_PROVIDER=ollama  # or openai, gemini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_REMOTE_URL=  # For remote Ollama via ngrok

OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4-turbo-preview

GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-1.5-pro
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/wizard
```

### Step 1: Upload Files

**POST** `/upload`

Upload multiple documents (PDF, DOCX, XLSX)

**Request:**
```bash
curl -X POST http://localhost:3000/api/wizard/upload \
  -F "files=@document1.pdf" \
  -F "files=@document2.docx" \
  -F "userId=user123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "files": [
      {
        "id": "file-id-1",
        "filename": "document1.pdf",
        "size": 102400,
        "tokenCount": 1500,
        "sections": [...]
      }
    ],
    "tokenEstimate": {
      "total": 3000,
      "estimatedCost": 0.05,
      "recommendations": ["Compatible with 15 models"]
    },
    "canProcess": true
  }
}
```

### Step 2: Submit Prompts

**POST** `/prompts`

Submit prompts with priority and targeting

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "prompts": [
    {
      "content": "Extract revenue from Q4 section",
      "priority": 1,
      "targetType": "SECTION_SPECIFIC",
      "targetSection": "Q4"
    },
    {
      "content": "Update lines 45-60 with new data",
      "priority": 2,
      "targetType": "LINE_SPECIFIC",
      "targetFileId": "file-id-1",
      "targetLines": { "start": 45, "end": 60 }
    },
    {
      "content": "Merge all into 2025 summary",
      "priority": 3,
      "targetType": "GLOBAL"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "prompts": [...],
    "estimatedTime": 30,
    "status": "queued"
  }
}
```

### Step 3: Get Processing Status

**GET** `/status/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PROCESSING",
    "progress": 66,
    "prompts": {
      "total": 3,
      "completed": 2,
      "processing": 1,
      "pending": 0
    },
    "hasClarifications": true,
    "hasResult": false
  }
}
```

### Step 4: Get Clarifications

**GET** `/clarifications/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "clarifications": [
      {
        "id": "clarif-id-1",
        "question": "Found two different revenue values. Which to use?",
        "context": { "promptId": "...", "values": ["150000", "152000"] },
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ]
  }
}
```

**POST** `/clarifications/respond`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "clarificationId": "clarif-id-1",
  "response": "Use the first value (150000)"
}
```

### Step 5: Get Result

**GET** `/result/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "result": {
      "id": "result-id-1",
      "version": 1,
      "content": "# Zpracovaný dokument\n\n## Revenue Q4...",
      "format": "markdown",
      "status": "PENDING_CONFIRMATION"
    }
  }
}
```

**POST** `/result/confirm`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "resultId": "result-id-1",
  "action": "CONFIRM"  // or "MODIFY", "REGENERATE"
}
```

### Step 6: Modify Result

**POST** `/result/modify`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "resultId": "result-id-1",
  "modifications": "# Updated document\n\n..."
}
```

**Response with diff:**
```json
{
  "success": true,
  "data": {
    "result": {
      "id": "result-id-2",
      "version": 2,
      "content": "..."
    },
    "diff": [...],
    "previousVersion": 1
  }
}
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 22+, TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis with ioredis
- **AI**: LangChain with Ollama, OpenAI, Google Gemini
- **Document Processing**:
  - PDF: pdf-parse, pdf-lib
  - DOCX: mammoth
  - XLSX: xlsx
- **Token Estimation**: tiktoken
- **Markdown**: markdown-it, markdown-table
- **Security**: helmet, express-rate-limit
- **Logging**: winston

## 📊 Database Schema

The system uses Prisma with PostgreSQL. Key models:

- **Session**: Manages user sessions with expiration
- **File**: Uploaded files with extracted content and metadata
- **Prompt**: User prompts with priority and targeting
- **Conversation**: AI-user conversations with threading
- **Result**: Generated documents with versioning

See `prisma/schema.prisma` for full schema.

## 🔧 Configuration

### AI Provider Setup

#### Ollama (Local)
```bash
ollama serve
ollama pull llama3.1:8b
```

#### Ollama (Remote via ngrok)
```env
OLLAMA_REMOTE_URL=https://your-ngrok-url.ngrok.io
```

#### OpenAI
```env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

#### Google Gemini
```env
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro
```

## 🌍 Czech Language Support

The system is optimized for Czech language:

- AI system prompts in Czech
- Czech uncertainty detection patterns
- UTF-8 support for Czech characters
- Markdown output with proper Czech formatting

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run specific test
npm test -- wizard.test.ts
```

## 📝 Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## 🔒 Security Features

- Helmet.js for HTTP security headers
- Rate limiting (100 requests per 15 minutes)
- File type validation
- File size limits (50MB default)
- Input validation with Joi
- CORS configuration
- Error sanitization in production

## 📈 Performance

- Redis caching for active sessions and conversations
- Database indexing on frequently queried fields
- Response compression with gzip
- Efficient token estimation
- Streaming support for large AI responses
- Automatic session cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT

## 🐛 Troubleshooting

### Common Issues

**Redis connection failed**
```bash
# Start Redis
redis-server
```

**Database connection failed**
```bash
# Run migrations
npx prisma migrate dev
```

**Ollama not responding**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags
```

**File upload fails**
- Check `UPLOAD_DIR` exists and has write permissions
- Verify file size is under `MAX_FILE_SIZE`
- Ensure file type is in `ALLOWED_FILE_TYPES`

## 📞 Support

For issues and questions, please open an issue on GitHub.

## 🎯 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Batch file processing
- [ ] Advanced table extraction
- [ ] OCR support for scanned documents
- [ ] Multi-language support beyond Czech
- [ ] Export to various formats (PDF, DOCX)
- [ ] Admin dashboard
- [ ] Metrics and analytics
- [ ] Automated testing suite

---

Built with ❤️ for efficient document processing with AI
