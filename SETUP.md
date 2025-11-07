# Setup Guide

## Quick Start

### Option 1: Docker (Recommended)

The easiest way to get started:

```bash
# 1. Clone and setup
git clone <repository-url>
cd DP-BE-Redis

# 2. Create environment file
cp .env.example .env

# 3. Start everything with Docker Compose
docker-compose up -d

# 4. Check status
docker-compose ps

# 5. View logs
docker-compose logs -f api
```

Your API will be available at `http://localhost:3000`

### Option 2: Manual Setup

#### Prerequisites

Install these first:
- Node.js 20+ ([Download](https://nodejs.org/))
- PostgreSQL 12+ ([Download](https://www.postgresql.org/download/))
- Redis 6+ ([Download](https://redis.io/download))
- Ollama (optional, for local AI) ([Download](https://ollama.ai/))

#### Steps

1. **Install dependencies**
```bash
npm install
```

> **Troubleshooting Installation:**
> - The project includes a `.npmrc` file with `legacy-peer-deps=true` to handle LangChain dependency conflicts
> - If npm install fails, ensure you have Node.js 20+ installed
> - On Windows, you may need to run PowerShell as Administrator
> - If issues persist, delete `node_modules` and `package-lock.json`, then retry

2. **Set up database**
```bash
# Create PostgreSQL database
createdb document_processor

# Run migrations
npx prisma migrate dev
npx prisma generate
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Start services**
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start API
npm run dev
```

## AI Provider Setup

Choose one or more AI providers:

### Ollama (Local - Free)

Best for privacy and cost-free operation.

```bash
# Install Ollama
# Visit https://ollama.ai/ for installation

# Start Ollama
ollama serve

# Pull a model
ollama pull llama3.1:8b

# Configure in .env
DEFAULT_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

**Recommended models:**
- `llama3.1:8b` - Fast, good quality (8GB RAM)
- `llama3.1:70b` - Best quality (64GB RAM)
- `mistral:7b` - Fast alternative
- `mixtral:8x7b` - High quality alternative

### Ollama Remote (via ngrok)

Use Ollama on another machine or expose your local Ollama.

```bash
# On the machine with Ollama
ollama serve

# In another terminal, create ngrok tunnel
ngrok http 11434

# Copy the https URL (e.g., https://abc123.ngrok.io)

# Configure in .env
DEFAULT_AI_PROVIDER=ollama-remote
OLLAMA_REMOTE_URL=https://abc123.ngrok.io
OLLAMA_MODEL=llama3.1:8b
```

### OpenAI

Best for highest quality and reliability.

```bash
# Get API key from https://platform.openai.com/api-keys

# Configure in .env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

**Cost:** ~$0.01-0.03 per 1000 tokens

**Recommended models:**
- `gpt-4-turbo-preview` - Best quality
- `gpt-3.5-turbo` - Fast and cheap

### Google Gemini

Good balance of quality and cost, huge context window.

```bash
# Get API key from https://makersuite.google.com/app/apikey

# Configure in .env
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro
```

**Cost:** ~$0.0035 per 1000 tokens

**Recommended models:**
- `gemini-1.5-pro` - 1M token context, excellent quality
- `gemini-1.0-pro` - Fast and cheap

## Database Setup

### PostgreSQL

```bash
# Option 1: Using Docker
docker run --name dp-postgres \
  -e POSTGRES_USER=dpuser \
  -e POSTGRES_PASSWORD=dppassword \
  -e POSTGRES_DB=document_processor \
  -p 5432:5432 \
  -d postgres:15-alpine

# Option 2: Local installation
createuser -P dpuser
createdb -O dpuser document_processor

# Update .env
DATABASE_URL=postgresql://dpuser:dppassword@localhost:5432/document_processor
```

### Redis

```bash
# Option 1: Using Docker
docker run --name dp-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Option 2: Local installation (macOS)
brew install redis
brew services start redis

# Option 3: Local installation (Ubuntu)
sudo apt-get install redis-server
sudo systemctl start redis

# Test connection
redis-cli ping
# Should return: PONG
```

## First API Call

Test that everything works:

```bash
# 1. Check health
curl http://localhost:3000/health

# 2. Upload a test file
curl -X POST http://localhost:3000/api/wizard/upload \
  -F "files=@test.pdf"

# 3. Check the response
# You should get a sessionId and file metadata
```

## API Documentation

### Swagger UI (Interactive)

Open your browser and navigate to:

```
http://localhost:3000/api-docs
```

The Swagger UI provides:
- Complete API reference
- Interactive testing (try requests directly in browser)
- Request/response examples
- Schema definitions
- Parameter descriptions

### Alternative Formats

- **JSON:** `http://localhost:3000/api-docs.json`
- **YAML:** `http://localhost:3000/api-docs.yaml`

### Using Swagger

1. Open `http://localhost:3000/api-docs` in your browser
2. Browse available endpoints organized by tags
3. Click on any endpoint to expand it
4. Click "Try it out" to test the endpoint
5. Fill in parameters and click "Execute"
6. View the response directly in the UI

**Example: Testing File Upload**
1. Navigate to POST `/api/wizard/upload`
2. Click "Try it out"
3. Click "Choose File" and select a PDF/DOCX/XLSX
4. Click "Execute"
5. See the response with sessionId and file metadata

## Troubleshooting

### Port already in use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or change port in .env
PORT=3001
```

### PostgreSQL connection failed

```bash
# Check PostgreSQL is running
pg_isready

# Check connection string
psql postgresql://dpuser:dppassword@localhost:5432/document_processor

# If migration fails, reset
npx prisma migrate reset
npx prisma migrate dev
```

### Redis connection failed

```bash
# Check Redis is running
redis-cli ping

# If not running
redis-server

# Check connection
redis-cli
> ping
> exit
```

### Ollama not responding

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start Ollama
ollama serve

# Pull models
ollama list
ollama pull llama3.1:8b
```

### File upload fails

```bash
# Create uploads directory
mkdir -p uploads

# Check permissions
chmod 755 uploads

# Check disk space
df -h
```

## Environment Variables Checklist

Minimum required variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (required)
DATABASE_URL=postgresql://dpuser:dppassword@localhost:5432/document_processor

# Redis (required)
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Provider (pick one)
DEFAULT_AI_PROVIDER=ollama  # or openai, gemini, ollama-remote

# If using Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# If using OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# If using Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro
```

## Development Workflow

```bash
# 1. Make changes to code
# 2. TypeScript will auto-compile (if using npm run dev)

# 3. Test your changes
curl http://localhost:3000/api/wizard/upload -F "files=@test.pdf"

# 4. Check logs
# Logs are in logs/ directory
tail -f logs/combined.log

# 5. Check database
npx prisma studio
# Opens at http://localhost:5555
```

## Production Deployment

### Using Docker

```bash
# Build image
docker build -t dp-be-redis .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d

# Or run manually
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_HOST=redis \
  --name dp-api \
  dp-be-redis
```

### Manual Deployment

```bash
# 1. Build
npm run build

# 2. Set production env
export NODE_ENV=production

# 3. Run migrations
npx prisma migrate deploy

# 4. Start with PM2
npm install -g pm2
pm2 start dist/index.js --name dp-api

# 5. Setup PM2 to start on boot
pm2 startup
pm2 save
```

### Environment-specific settings

**Production .env:**
```env
NODE_ENV=production
LOG_LEVEL=warn

# Use production databases
DATABASE_URL=postgresql://...
REDIS_HOST=production-redis.example.com

# Use SSL for database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Adjust limits
MAX_CONCURRENT_PROCESSING=10
RATE_LIMIT_MAX_REQUESTS=1000
```

## Next Steps

1. Read the [API Documentation](API.md)
2. Check out the [README](README.md) for features
3. Test the wizard flow with sample documents
4. Integrate with your frontend

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in `logs/` directory
3. Check Docker logs: `docker-compose logs`
4. Open an issue on GitHub

Happy document processing! 🚀
