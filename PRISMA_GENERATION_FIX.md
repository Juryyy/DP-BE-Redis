# Prisma Client Generation Fix

## Problem
The Prisma client needs to be regenerated after the schema changes (adding `contextWindow` field), but network errors are preventing `npx prisma generate` from downloading engine binaries.

## Solutions

### Option 1: Use Docker Compose (Recommended)
The Docker setup handles Prisma generation automatically during container startup:

```bash
docker-compose up --build
```

This will:
1. Build the container
2. Run `npx prisma migrate dev` (applies the `contextWindow` migration)
3. Run `npx prisma generate` (generates the client with new types)
4. Start the application

### Option 2: Retry Prisma Generate
The 403 errors might be temporary network issues. Try:

```bash
npm install
npx prisma generate
npm run build
```

### Option 3: Apply Migration and Generate Manually
If you have database access:

1. Apply the migration to your database:
```sql
ALTER TABLE "OllamaModel" ADD COLUMN IF NOT EXISTS "contextWindow" INTEGER;
```

2. Generate Prisma client:
```bash
npx prisma db pull  # Pull current database schema
npx prisma generate # Generate client
```

### Option 4: Use Pre-generated Client from Another Machine
If you have access to another machine with working Prisma:

1. On the working machine:
```bash
git pull
npm install
npx prisma generate
tar -czf prisma-client.tar.gz node_modules/.prisma node_modules/@prisma
```

2. Copy `prisma-client.tar.gz` to this machine and extract:
```bash
tar -xzf prisma-client.tar.gz
```

## Verify It's Fixed
After regenerating, check that the build succeeds:

```bash
npm run build
```

You should see no TypeScript errors about missing `contextWindow` or Prisma exports.

## What Was Changed
- Added `contextWindow` field to `OllamaModel` schema in `prisma/schema.prisma`
- Created migration in `prisma/migrations/20251108_add_context_window/`
- Updated services to use model-specific context window sizes
- Replaced hardcoded 100KB threshold with dynamic calculations based on each model's capabilities
