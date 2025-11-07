# API Documentation

## Base URL
```
http://localhost:3000/api/wizard
```

## Authentication
Currently, no authentication is required. In production, implement proper authentication (JWT, OAuth, etc.).

## Response Format
All responses follow this structure:

```json
{
  "success": true | false,
  "data": { ... },
  "error": "error message" // only if success is false
}
```

## Endpoints

### 1. Upload Files

Upload multiple documents to start a new session.

**Endpoint:** `POST /upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `files` (required): One or more files (PDF, DOCX, XLSX)
- `userId` (optional): User identifier
- `metadata` (optional): JSON string with additional metadata

**Example cURL:**
```bash
curl -X POST http://localhost:3000/api/wizard/upload \
  -F "files=@/path/to/document1.pdf" \
  -F "files=@/path/to/document2.docx" \
  -F "userId=user123" \
  -F 'metadata={"project":"Q4-2024"}'
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "files": [
      {
        "id": "file-uuid-1",
        "filename": "document1.pdf",
        "size": 102400,
        "mimeType": "application/pdf",
        "tokenCount": 1500,
        "sections": [
          {
            "title": "Introduction",
            "level": 1,
            "startLine": 0,
            "endLine": 50
          }
        ],
        "tables": [...]
      }
    ],
    "tokenEstimate": {
      "total": 3000,
      "estimatedCost": 0.05,
      "recommendations": [
        "✓ Compatible with 15 models",
        "Recommended: GPT-3.5-turbo or Llama 3.1 (cost-effective)"
      ]
    },
    "modelCompatibility": {
      "gpt-4-turbo-preview": {
        "compatible": true,
        "maxTokens": 128000,
        "remainingTokens": 125000,
        "percentageUsed": 2.34
      }
    },
    "canProcess": true,
    "expiresAt": "2024-01-01T13:00:00.000Z"
  }
}
```

---

### 2. Submit Prompts

Submit one or more prompts with priority and targeting.

**Endpoint:** `POST /prompts`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "prompts": [
    {
      "content": "Extract all revenue figures from Q4 section",
      "priority": 1,
      "targetType": "SECTION_SPECIFIC",
      "targetSection": "Q4"
    },
    {
      "content": "Update the revenue table with new values",
      "priority": 2,
      "targetType": "LINE_SPECIFIC",
      "targetFileId": "file-uuid-1",
      "targetLines": {
        "start": 45,
        "end": 60
      }
    },
    {
      "content": "Merge all documents into a comprehensive 2025 summary",
      "priority": 3,
      "targetType": "GLOBAL"
    }
  ]
}
```

**Target Types:**
- `FILE_SPECIFIC`: Target a specific file (requires `targetFileId`)
- `LINE_SPECIFIC`: Target specific lines in a file (requires `targetFileId` and `targetLines`)
- `SECTION_SPECIFIC`: Target a detected section (requires `targetSection`)
- `GLOBAL`: Process all files

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "prompts": [
      {
        "id": "prompt-uuid-1",
        "content": "Extract all revenue figures from Q4 section",
        "priority": 1,
        "targetType": "SECTION_SPECIFIC",
        "executionOrder": 1
      }
    ],
    "estimatedTime": 30,
    "status": "queued"
  }
}
```

---

### 3. Get Processing Status

Check the processing status of a session.

**Endpoint:** `GET /status/:sessionId`

**Example:**
```bash
curl http://localhost:3000/api/wizard/status/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200):**
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
      "pending": 0,
      "failed": 0
    },
    "hasClarifications": true,
    "clarificationCount": 1,
    "hasResult": false,
    "result": null
  }
}
```

**Session Status Values:**
- `ACTIVE`: Session created, ready for prompts
- `PROCESSING`: AI is processing prompts
- `COMPLETED`: All processing complete
- `FAILED`: Processing failed
- `EXPIRED`: Session expired

---

### 4. Get Clarifications

Retrieve pending clarification questions from the AI.

**Endpoint:** `GET /clarifications/:sessionId`

**Example:**
```bash
curl http://localhost:3000/api/wizard/clarifications/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "clarifications": [
      {
        "id": "clarif-uuid-1",
        "question": "Našel jsem dvě různé hodnoty příjmů (150000 a 152000). Kterou mám použít?",
        "context": {
          "promptId": "prompt-uuid-1",
          "values": ["150000", "152000"],
          "location": "Section Q4, lines 45-47"
        },
        "createdAt": "2024-01-01T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 5. Respond to Clarification

Answer a clarification question from the AI.

**Endpoint:** `POST /clarifications/respond`

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "clarificationId": "clarif-uuid-1",
  "response": "Použij první hodnotu (150000)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "clarificationId": "clarif-uuid-1",
    "status": "answered"
  }
}
```

---

### 6. Get Result

Retrieve the processed document result.

**Endpoint:** `GET /result/:sessionId`

**Query Parameters:**
- `version` (optional): Specific version number

**Example:**
```bash
curl http://localhost:3000/api/wizard/result/550e8400-e29b-41d4-a716-446655440000
curl http://localhost:3000/api/wizard/result/550e8400-e29b-41d4-a716-446655440000?version=2
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "result": {
      "id": "result-uuid-1",
      "version": 1,
      "content": "# Zpracovaný dokument\n\n## Revenue Q4\n\n| Month | Revenue |\n|-------|--------|\n| Oct   | 50000  |\n| Nov   | 52000  |\n| Dec   | 48000  |\n\n**Total:** 150000\n\n---\n\n## Summary for 2025...",
      "format": "markdown",
      "status": "PENDING_CONFIRMATION",
      "metadata": {
        "promptCount": 3,
        "generatedAt": "2024-01-01T11:00:00.000Z"
      },
      "createdAt": "2024-01-01T11:00:00.000Z"
    }
  }
}
```

**Result Status Values:**
- `DRAFT`: Work in progress
- `PENDING_CONFIRMATION`: Ready for user review
- `CONFIRMED`: User confirmed the result
- `MODIFIED`: Result has been modified

---

### 7. Confirm Result

Confirm, modify, or regenerate a result.

**Endpoint:** `POST /result/confirm`

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "resultId": "result-uuid-1",
  "action": "CONFIRM"
}
```

**Actions:**
- `CONFIRM`: Accept and finalize the result
- `MODIFY`: Move to modification step
- `REGENERATE`: Re-run all prompts from scratch

**Success Response (200) - CONFIRM:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "resultId": "result-uuid-1",
    "status": "confirmed",
    "message": "Document confirmed successfully"
  }
}
```

**Success Response (200) - REGENERATE:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "regenerating",
    "message": "Regenerating document"
  }
}
```

---

### 8. Modify Result

Modify a result with direct edits or new prompts.

**Endpoint:** `POST /result/modify`

**Request Body (Direct Edit):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "resultId": "result-uuid-1",
  "modifications": "# Updated Document\n\n## Revenue Q4 (Revised)\n\n..."
}
```

**Request Body (New Prompts):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "resultId": "result-uuid-1",
  "modifications": [
    {
      "content": "Add a summary section at the beginning",
      "priority": 1
    },
    {
      "content": "Include YoY comparison",
      "priority": 2
    }
  ]
}
```

**Success Response (200) - Direct Edit:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "result": {
      "id": "result-uuid-2",
      "version": 2,
      "content": "# Updated Document\n\n..."
    },
    "diff": [
      {
        "count": 5,
        "added": true,
        "value": "## Revenue Q4 (Revised)\n\n..."
      },
      {
        "count": 3,
        "removed": true,
        "value": "## Revenue Q4\n\n..."
      }
    ],
    "previousVersion": 1
  }
}
```

---

### 9. Get Conversation History

Retrieve the full conversation history for a session.

**Endpoint:** `GET /conversation/:sessionId`

**Query Parameters:**
- `limit` (optional): Limit number of messages

**Example:**
```bash
curl http://localhost:3000/api/wizard/conversation/550e8400-e29b-41d4-a716-446655440000?limit=10
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "messages": [
      {
        "id": "msg-uuid-1",
        "type": "GENERAL",
        "role": "ASSISTANT",
        "content": "Zpracovávám první úkol...",
        "createdAt": "2024-01-01T10:15:00.000Z"
      },
      {
        "id": "msg-uuid-2",
        "type": "CLARIFICATION",
        "role": "ASSISTANT",
        "content": "Našel jsem dvě hodnoty...",
        "createdAt": "2024-01-01T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 10. Get Session Details

Get complete session information including files, prompts, and results.

**Endpoint:** `GET /session/:sessionId`

**Example:**
```bash
curl http://localhost:3000/api/wizard/session/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "PROCESSING",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "expiresAt": "2024-01-01T13:00:00.000Z",
      "files": [...],
      "prompts": [...],
      "results": [...]
    },
    "conversation": {
      "totalMessages": 15,
      "clarificationCount": 2,
      "lastMessageAt": "2024-01-01T11:00:00.000Z"
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation error: prompts is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Session not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to process request"
}
```

---

## Rate Limiting

- **Window:** 15 minutes (900,000 ms)
- **Max Requests:** 100 per IP
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets

---

## Workflow Example

Complete workflow from upload to confirmation:

```bash
# 1. Upload files
SESSION_ID=$(curl -X POST http://localhost:3000/api/wizard/upload \
  -F "files=@document.pdf" | jq -r '.data.sessionId')

# 2. Submit prompts
curl -X POST http://localhost:3000/api/wizard/prompts \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"prompts\": [{
      \"content\": \"Extract revenue data\",
      \"priority\": 1,
      \"targetType\": \"GLOBAL\"
    }]
  }"

# 3. Check status
curl http://localhost:3000/api/wizard/status/$SESSION_ID

# 4. Check clarifications (if any)
curl http://localhost:3000/api/wizard/clarifications/$SESSION_ID

# 5. Get result
RESULT_ID=$(curl http://localhost:3000/api/wizard/result/$SESSION_ID | jq -r '.data.result.id')

# 6. Confirm result
curl -X POST http://localhost:3000/api/wizard/result/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"resultId\": \"$RESULT_ID\",
    \"action\": \"CONFIRM\"
  }"
```

---

## WebSocket Support (Future)

Real-time updates for:
- Processing status
- New clarifications
- Results ready

Coming in future versions.
