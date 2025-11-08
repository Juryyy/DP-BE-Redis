# AI Code Organization Rules

This document outlines the code organization rules and best practices for this project. Follow these guidelines strictly when modifying or adding code.

## 📁 File Structure

### Types (`src/types/`)
**Rule:** All TypeScript interfaces and type definitions MUST be in the `src/types/` folder.

- Each domain has its own types file (e.g., `document.types.ts`, `llm.types.ts`)
- Never define interfaces directly in service or controller files
- Always export types through `src/types/index.ts`

**Example:**
```typescript
// ❌ BAD - Interface in service file
// src/services/my-service.ts
export interface MyData { ... }

// ✅ GOOD - Interface in types file
// src/types/my-data.types.ts
export interface MyData { ... }

// src/types/index.ts
export * from './my-data.types';
```

### Constants (`src/constants/`)
**Rule:** All hardcoded values, configuration, and constant strings MUST be in the `src/constants/` folder.

**What goes in constants:**
- Model pricing and configurations
- Token thresholds and limits
- System prompts and messages
- Provider URLs and endpoints
- File size limits
- MIME types
- Regex patterns
- Default values

**What does NOT go in constants:**
- Type definitions (use `src/types/`)
- Runtime configurations (use environment variables)
- Database models (use Prisma schema)

**Example:**
```typescript
// ❌ BAD - Hardcoded in service
const MAX_SIZE = 10485760;
const prompt = "You are an AI assistant...";

// ✅ GOOD - Defined in constants
// src/constants/app.constants.ts
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// src/constants/prompts.constants.ts
export const SYSTEM_PROMPT = "You are an AI assistant...";
```

### Controllers (`src/controllers/`)
**Rule:** Controllers handle HTTP request/response logic only.

**Controllers should:**
- Extract data from request
- Call service methods
- Format responses
- Handle HTTP errors
- Be focused on a single domain (upload, prompt, processing, etc.)

**Controllers should NOT:**
- Contain business logic
- Access database directly
- Define types or interfaces
- Have hardcoded values

**Example:**
```typescript
// ✅ GOOD
export class UploadController {
  static async uploadFiles(req: Request, res: Response): Promise<void> {
    const { userId } = req.body;
    const files = req.files as Express.Multer.File[];

    const session = await SessionService.createSession(userId);

    res.json({ success: true, data: { sessionId: session.id } });
  }
}
```

### Services (`src/services/`)
**Rule:** Services contain business logic and data operations.

**Services should:**
- Implement business logic
- Interact with database
- Call external APIs
- Handle data transformations
- Be stateless and reusable

**Services should NOT:**
- Define types or interfaces (use `src/types/`)
- Have hardcoded values (use `src/constants/`)
- Handle HTTP request/response (use controllers)

### Middlewares (`src/middlewares/`)
**Rule:** Middlewares handle cross-cutting concerns.

**Use middlewares for:**
- Request validation
- Error handling
- Authentication/authorization
- Logging
- Rate limiting
- Request transformation

**Example:**
```typescript
// ✅ GOOD - Reusable validation middleware
export const validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { sessionId } = req.params;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  next();
};
```

### Routes (`src/routes/`)
**Rule:** Routes should be thin - just wire controllers and middlewares together.

**Routes should:**
- Define URL paths
- Apply middlewares
- Call controllers
- Be focused on a single API domain

**Routes should NOT:**
- Contain business logic
- Access database
- Define inline handlers (use controllers)

**Example:**
```typescript
// ✅ GOOD - Clean route definition
router.post(
  '/upload',
  upload.array('files', 10),
  validateFileUpload,
  asyncHandler(UploadController.uploadFiles)
);

// ❌ BAD - Logic in route
router.post('/upload', async (req, res) => {
  const files = req.files;
  const session = await prisma.session.create({ ... });
  // ... more logic
});
```

## 🎯 MVC Architecture

This project follows MVC (Model-View-Controller) pattern:

```
Request → Route → Middleware → Controller → Service → Database
                                     ↓
Response ← Route ← Middleware ← Controller ← Service ← Database
```

1. **Model** = Prisma schema + Types
2. **View** = JSON responses
3. **Controller** = HTTP handlers
4. **Service** = Business logic

## 📝 Naming Conventions

### Files
- Types: `*.types.ts` (e.g., `document.types.ts`)
- Constants: `*.constants.ts` (e.g., `app.constants.ts`)
- Controllers: `*.controller.ts` (e.g., `upload.controller.ts`)
- Services: `*.service.ts` (e.g., `session.service.ts`)
- Middlewares: `*.middleware.ts` (e.g., `validation.middleware.ts`)
- Routes: `*.routes.ts` (e.g., `wizard.routes.ts`)

### Variables and Functions
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- Functions: `camelCase` (e.g., `createSession`)
- Classes: `PascalCase` (e.g., `UploadController`)
- Interfaces: `PascalCase` (e.g., `ParsedDocument`)
- Types: `PascalCase` (e.g., `AIProvider`)

## 🔄 Import Organization

**Order of imports:**
```typescript
// 1. External dependencies
import express from 'express';
import axios from 'axios';

// 2. Internal config/database
import prisma from '../config/database';

// 3. Types (centralized import)
import { OllamaModelInfo, OllamaModelUpdate } from '../types';

// 4. Constants (centralized import)
import { MAX_FILE_SIZE, PREFERRED_OLLAMA_MODELS } from '../constants';

// 5. Services
import { SessionService } from '../services/session.service';

// 6. Utils
import { logger } from '../utils/logger';
```

**Import rules:**
- Always import from `../types` (not individual type files)
- Always import from `../constants` (not individual constant files)
- Use named imports for better tree-shaking
- Group imports by category

## 🚫 Anti-Patterns to Avoid

### ❌ Inline Types
```typescript
// BAD
function process(data: { name: string; size: number }) { ... }

// GOOD
// src/types/processing.types.ts
export interface ProcessingData {
  name: string;
  size: number;
}

// service
function process(data: ProcessingData) { ... }
```

### ❌ Magic Numbers/Strings
```typescript
// BAD
if (file.size > 10485760) { ... }
const model = 'gpt-4';

// GOOD
if (file.size > MAX_FILE_SIZE) { ... }
const model = DEFAULT_MODEL;
```

### ❌ Logic in Routes
```typescript
// BAD
router.post('/data', async (req, res) => {
  const data = await prisma.data.create({ ... });
  const processed = data.map(x => x * 2);
  res.json(processed);
});

// GOOD
router.post('/data', asyncHandler(DataController.create));
```

### ❌ Controllers with Business Logic
```typescript
// BAD - Controller with complex logic
export class Controller {
  static async handle(req, res) {
    const result = await complexCalculation();
    const transformed = await transform(result);
    // ... more logic
  }
}

// GOOD - Delegate to service
export class Controller {
  static async handle(req, res) {
    const result = await MyService.processData();
    res.json({ success: true, data: result });
  }
}
```

## ✅ Checklist for New Features

When adding new features, ensure:

- [ ] All types defined in `src/types/`
- [ ] All constants defined in `src/constants/`
- [ ] Business logic in services
- [ ] HTTP handling in controllers
- [ ] Routes are thin (just wiring)
- [ ] Reusable logic extracted to middleware
- [ ] No hardcoded values
- [ ] No inline type definitions
- [ ] Proper error handling
- [ ] Documentation comments added

## 📚 Example Structure

```
src/
├── types/              # All TypeScript interfaces/types
│   ├── document.types.ts
│   ├── llm.types.ts
│   ├── ollama.types.ts
│   └── index.ts        # Central export
│
├── constants/          # All hardcoded values
│   ├── app.constants.ts
│   ├── models.constants.ts
│   ├── prompts.constants.ts
│   └── index.ts        # Central export
│
├── controllers/        # HTTP request handlers
│   ├── upload.controller.ts
│   ├── prompt.controller.ts
│   └── index.ts
│
├── services/           # Business logic
│   ├── session.service.ts
│   ├── ollama-model.service.ts
│   └── llm.service.ts
│
├── middlewares/        # Request processing
│   ├── validation.middleware.ts
│   ├── error.middleware.ts
│   └── index.ts
│
└── routes/             # URL routing
    ├── wizard.routes.ts
    ├── admin.routes.ts
    └── index.ts
```

## 🔍 Code Review Guidelines

Before committing, verify:

1. **No types in services/controllers** - Check for `interface` or `type` keywords
2. **No hardcoded values** - Check for magic numbers, strings, or repeated values
3. **Proper separation** - Business logic in services, HTTP in controllers
4. **Centralized imports** - Import from `../types` and `../constants`, not individual files
5. **Clean routes** - No logic in route files
6. **Proper naming** - Follow naming conventions for all files and variables

## 🚀 Performance Considerations

- Import only what you need (named imports)
- Constants are optimized at build time
- Types are removed in production builds
- Services should be stateless for better scalability
- Use caching where appropriate (e.g., Ollama model cache)

---

**Remember:** Clean, organized code is maintainable code. Follow these rules consistently!
