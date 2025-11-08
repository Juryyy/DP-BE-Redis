# Changelog

All notable changes, fixes, and refactorings to this project are documented here.

## 📋 Table of Contents
- [Recent Changes (2025-01-08)](#recent-changes-2025-01-08)
- [Refactoring](#refactoring)
- [Bug Fixes](#bug-fixes)
- [Features](#features)
- [Database Changes](#database-changes)
- [Breaking Changes](#breaking-changes)

---

## Recent Changes (2025-01-08)

### 🎯 Code Organization & Type Safety

#### Moved Interfaces to Types Folder
**What changed:**
- Extracted `OllamaModelInfo` interface from `ollama-model.service.ts` to `src/types/ollama.types.ts`
- Created `OllamaModelUpdate` type for model configuration updates
- Updated service to import from centralized types

**Why:** Follow MVC best practices - services should not define types

**Files affected:**
- `src/types/ollama.types.ts` (created)
- `src/types/index.ts` (updated)
- `src/services/ollama-model.service.ts` (updated)

#### Documentation
**What changed:**
- Created `AI_RULES.md` - Comprehensive code organization guidelines
- Created `CHANGELOG.md` - This document

**Why:** Help AI and developers maintain consistent code organization

---

## Refactoring

### 1️⃣ MVC Architecture Implementation

**Date:** 2025-01-07

**What changed:**
Split 693-line monolithic `wizard.routes.ts` into proper MVC structure:

**Controllers created:**
- `src/controllers/upload.controller.ts` - File upload and document parsing
- `src/controllers/prompt.controller.ts` - Prompt submission and queuing
- `src/controllers/processing.controller.ts` - Processing status tracking
- `src/controllers/clarification.controller.ts` - AI clarification handling
- `src/controllers/result.controller.ts` - Result management
- `src/controllers/session.controller.ts` - Session and conversation management
- `src/controllers/admin.controller.ts` - Ollama model administration

**Middlewares created:**
- `src/middlewares/validation.middleware.ts` - Session, file, and field validation
- `src/middlewares/error.middleware.ts` - Async error handling wrapper

**Why:**
- Separation of concerns
- Better testability
- Easier maintenance
- Reduced code duplication (~170 lines removed)

**Files affected:**
- Split from: `src/routes/wizard.routes.ts` (693 lines)
- New structure: Controllers (6 files) + Middlewares (2 files) + Routes (~145 lines)

### 2️⃣ Types Extraction

**Date:** 2025-01-07

**What changed:**
Extracted all inline types and interfaces to dedicated type files:

**Type files created:**
- `src/types/document.types.ts` - Document parsing types
  - `ParsedDocument`
  - `DocumentMetadata`
  - `DocumentSection`
  - `DocumentTable`

- `src/types/llm.types.ts` - AI provider types
  - `AIProvider`
  - `LLMConfig`
  - `ChatMessage`
  - `LLMResponse`

- `src/types/conversation.types.ts` - Conversation types
  - `ConversationMessage`
  - `ConversationThread`

- `src/types/session.types.ts` - Session types
  - `SessionData`

- `src/types/processing.types.ts` - Processing queue types
  - `ProcessingJob`
  - `ProcessingResult`

- `src/types/token.types.ts` - Token estimation types
  - `TokenEstimate`
  - `ModelCompatibility`

- `src/types/ollama.types.ts` - Ollama model types
  - `OllamaModelInfo`
  - `OllamaModelUpdate`

**Why:**
- Centralized type definitions
- Better type reusability
- Easier to maintain
- Follows TypeScript best practices

### 3️⃣ Constants Extraction

**Date:** 2025-01-07

**What changed:**
Moved all hardcoded values to constant files:

**Constant files created:**
- `src/constants/app.constants.ts` - Application configuration
  - `MAX_FILE_SIZE = 10 * 1024 * 1024`
  - `MAX_CONCURRENT_PROCESSING = 5`
  - `SESSION_CLEANUP_INTERVAL_MS = 3600000`
  - `SUPPORTED_MIME_TYPES`
  - File size limits per type

- `src/constants/models.constants.ts` - Model configuration
  - `MODEL_PRICING` - Pricing per 1M tokens for all AI providers
  - `TOKEN_THRESHOLDS` - Size categories (small, medium, large, veryLarge)
  - `MODEL_RECOMMENDATIONS` - Recommendations by token range
  - `PREFERRED_OLLAMA_MODELS` - Ordered list of preferred models
  - `OLLAMA_MODEL_CACHE_TTL = 300000` (5 minutes)

- `src/constants/prompts.constants.ts` - Prompts and patterns
  - `CZECH_SYSTEM_PROMPT` - Czech language system prompt
  - `UNCERTAINTY_PATTERNS` - Regex patterns for uncertainty detection

**Why:**
- No magic numbers/strings
- Easy configuration updates
- Centralized pricing and thresholds
- Better maintainability

**Services updated to use constants:**
- `processing-queue.service.ts`
- `token-estimator.service.ts`
- `llm.service.ts`
- All controllers

---

## Bug Fixes

### 🐛 Database Migration Not Running

**Date:** 2025-01-07

**Problem:**
```
The table `public.Session` does not exist in the current database
```
Prisma migrations weren't running on Docker container startup.

**Root cause:**
- Application started before migrations completed
- No automated migration execution in Docker

**Solution:**
1. Created manual migration file:
   - `prisma/migrations/20250107000000_init/migration.sql`
   - Complete database schema with all tables

2. Created Docker entrypoint script:
   ```bash
   #!/bin/sh
   npx prisma migrate deploy
   exec node dist/index.js
   ```

3. Updated Dockerfile:
   - Copy and execute `docker-entrypoint.sh`
   - Added OpenSSL for Prisma

**Files affected:**
- `prisma/migrations/20250107000000_init/migration.sql` (created)
- `docker-entrypoint.sh` (created)
- `Dockerfile` (updated)
- `prisma/migrations/migration_lock.toml` (created)

### 🐛 Ollama Model Not Found

**Date:** 2025-01-07

**Problem:**
```
model 'llama3.1:8b' not found, try pulling it first
```
Hardcoded model names didn't match installed models.

**Root cause:**
- Static model configuration
- No auto-detection of available models
- App deployed separately from Ollama

**Solution (Phase 1 - Auto-detection):**
1. Added Ollama API integration:
   - Query `/api/tags` endpoint
   - Detect available models at runtime
   - 5-minute cache to reduce API calls

2. Made LLM service async:
   ```typescript
   static async create(config: LLMConfig): Promise<LLMService>
   ```

3. Implemented fallback logic:
   - Try user-requested model first
   - Fall back to first available from preferred list
   - Select any available model as last resort

**Files affected:**
- `src/services/llm.service.ts` (updated)
- `src/services/processing-queue.service.ts` (updated)

**Solution (Phase 2 - Database-backed):**
See [Features - Database-Backed Model Management](#database-backed-model-management)

---

## Features

### ✨ Database-Backed Model Management

**Date:** 2025-01-08

**What changed:**
Implemented full CRUD system for Ollama model management with PostgreSQL storage.

**Database Schema:**
```sql
CREATE TABLE "OllamaModel" (
  id              UUID PRIMARY KEY,
  name            VARCHAR UNIQUE,         -- e.g., "llama3.1:8b"
  displayName     VARCHAR,                -- e.g., "Llama 3.1 (8B)"
  size            BIGINT,                 -- Model size in bytes
  family          VARCHAR,                -- e.g., "llama"
  parameterSize   VARCHAR,                -- e.g., "8B"
  quantization    VARCHAR,                -- e.g., "Q4_0"
  isAvailable     BOOLEAN DEFAULT false,  -- In Ollama?
  isEnabled       BOOLEAN DEFAULT true,   -- Use this model?
  priority        INTEGER DEFAULT 100,    -- Lower = higher priority
  maxTokens       INTEGER,                -- Context window
  temperature     FLOAT,                  -- Default temperature
  lastChecked     TIMESTAMP,              -- Last availability check
  lastUsed        TIMESTAMP,              -- Last usage
  usageCount      INTEGER DEFAULT 0,      -- Usage tracking
  createdAt       TIMESTAMP,
  updatedAt       TIMESTAMP
);

CREATE INDEX idx_ollama_model_availability ON "OllamaModel"(isAvailable, isEnabled, priority);
CREATE INDEX idx_ollama_model_name ON "OllamaModel"(name);
```

**Admin API Endpoints:**
```
POST   /api/admin/models/sync              Sync models from Ollama
GET    /api/admin/models                   List all models
GET    /api/admin/models/recommended       Get best available model
POST   /api/admin/models/pull              Pull new model from Ollama
PATCH  /api/admin/models/:id               Update model config
DELETE /api/admin/models/:id               Delete from database
```

**Service Methods:**
- `OllamaModelService.syncModelsFromOllama()` - Query Ollama and sync to DB
- `OllamaModelService.getBestAvailableModel()` - Get highest priority enabled model
- `OllamaModelService.pullModel()` - Stream model download from Ollama
- `OllamaModelService.updateModel()` - Update configuration
- `OllamaModelService.deleteModel()` - Remove from database

**Smart Features:**
1. **Auto-priority calculation:**
   - `llama3.1:8b` = priority 10
   - `llama3:8b` = priority 20
   - `70b/72b` models = priority 200
   - Default = priority 100

2. **Display name generation:**
   - `llama3.1:8b` → "Llama 3.1 (8B)"
   - Automatic capitalization and formatting

3. **Usage tracking:**
   - Increments `usageCount` on each use
   - Updates `lastUsed` timestamp
   - Helps identify most-used models

4. **Availability management:**
   - Models removed from Ollama marked as `isAvailable=false`
   - Can keep configuration for models not currently installed
   - Easy to re-enable when model is available

**Why:**
- Deploy app separately from Ollama
- Change model preferences without code changes
- A/B test different models
- Track model usage statistics
- Pull new models via API
- Priority-based automatic selection

**Files affected:**
- `prisma/schema.prisma` (updated)
- `prisma/migrations/20251108000000_add_ollama_model/migration.sql` (created)
- `src/services/ollama-model.service.ts` (created)
- `src/controllers/admin.controller.ts` (created)
- `src/routes/admin.routes.ts` (created)
- `src/index.ts` (updated - added admin routes)
- `src/services/llm.service.ts` (updated - query DB first)
- `swagger.yaml` (updated - added admin endpoints)

### ✨ Comprehensive API Documentation

**Date:** 2025-01-08

**What changed:**
Updated Swagger/OpenAPI documentation with complete admin endpoints.

**Added:**
- Admin tag for categorization
- 6 admin endpoint definitions with full schemas
- `OllamaModel` schema with all fields
- Request/response examples
- Error response documentation

**Access:**
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI spec: `http://localhost:3000/api/swagger.yaml`

**Files affected:**
- `swagger.yaml` (340 lines added)

---

## Database Changes

### Migration History

#### 1. Initial Schema (20250107000000_init)
**Created tables:**
- Session
- UploadedFile
- Prompt
- Clarification
- Result
- ConversationMessage

**Enums:**
- SessionStatus
- PromptStatus
- PromptTargetType
- MessageType
- MessageRole
- ResultStatus

#### 2. Ollama Model Table (20251108000000_add_ollama_model)
**Created table:**
- OllamaModel (with indexes)

**Why:**
- Store model configurations
- Track model usage
- Enable runtime model management

---

## Breaking Changes

### ⚠️ LLM Service Now Async

**Changed:**
```typescript
// Before
const llm = createLLMService(config);

// After
const llm = await createLLMService(config);
```

**Reason:**
Auto-detection of Ollama models requires async API calls.

**Migration:**
Update all service instantiations to use `await`.

**Files affected:**
- `src/services/processing-queue.service.ts`
- Any custom code creating LLM instances

---

## Technical Improvements

### 🚀 Performance

1. **Ollama Model Caching**
   - 5-minute cache for model list
   - Reduces API calls to Ollama
   - Configurable via `OLLAMA_MODEL_CACHE_TTL`

2. **Database Indexing**
   - `OllamaModel` indexed on `(isAvailable, isEnabled, priority)`
   - Fast model selection queries
   - Efficient filtering

3. **Async Processing**
   - Model pulling runs in background
   - Non-blocking API responses
   - Better user experience

### 🔒 Error Handling

1. **Async Handler Middleware**
   ```typescript
   export const asyncHandler = (fn: Function) => {
     return (req, res, next) => {
       Promise.resolve(fn(req, res, next)).catch(next);
     };
   };
   ```
   - Automatic async error catching
   - No try-catch boilerplate in controllers

2. **Validation Middleware**
   - Session validation
   - File upload validation
   - Required field validation
   - Consistent error responses

### 📊 Code Metrics

**Before refactoring:**
- Single route file: 693 lines
- Hardcoded values: 50+
- Inline types: 20+
- Controllers: 0
- Middlewares: 0

**After refactoring:**
- Route file: ~145 lines (-79% reduction)
- Controllers: 7 files, well-organized
- Middlewares: 2 files, reusable
- Types: 7 files, centralized
- Constants: 3 files, configurable
- Hardcoded values: 0
- Inline types: 0

---

## Logic Changes

### 🧠 Model Selection Algorithm

**Old logic:**
1. Use hardcoded model name
2. Fail if not available

**New logic:**
1. Check database for best available model (by priority, usage)
2. If no DB model, query Ollama API
3. Try user-requested model
4. Fall back to first available from preferred list
5. Fall back to any available model
6. Fail only if no models available

**Priority calculation:**
```typescript
if (modelName.includes('llama3.1:8b')) return 10;  // Highest
if (modelName.includes('llama3:8b')) return 20;
if (modelName.includes('mistral:7b')) return 30;
if (modelName.includes('70b|72b')) return 200;     // Lowest
return 100; // Default
```

### 📝 Token Estimation Logic

**Extracted to constants:**
- Model pricing moved to `MODEL_PRICING`
- Thresholds moved to `TOKEN_THRESHOLDS`
- Recommendations moved to `MODEL_RECOMMENDATIONS`

**No logic changes, just better organization**

---

## Future Improvements

### 🔮 Planned

1. **Authentication**
   - API key authentication
   - User management
   - Role-based access control

2. **Model Management UI**
   - Web interface for model management
   - Real-time model pull progress
   - Usage analytics dashboard

3. **Enhanced Monitoring**
   - Model performance metrics
   - Cost tracking per model
   - Latency monitoring

4. **Multi-tenant Support**
   - Per-user model preferences
   - User-specific model access
   - Usage quotas

---

## Developer Notes

### 🛠️ How to Add New Features

1. **Define types first** in `src/types/`
2. **Add constants** in `src/constants/`
3. **Create service** with business logic in `src/services/`
4. **Create controller** for HTTP handling in `src/controllers/`
5. **Add middleware** if needed in `src/middlewares/`
6. **Wire in routes** in `src/routes/`
7. **Update Swagger** in `swagger.yaml`
8. **Update this changelog**

### 📚 References

- [AI_RULES.md](./AI_RULES.md) - Code organization guidelines
- [swagger.yaml](./swagger.yaml) - API documentation
- [prisma/schema.prisma](./prisma/schema.prisma) - Database schema

---

**Last Updated:** 2025-01-08
**Maintained by:** AI Assistant & Development Team
