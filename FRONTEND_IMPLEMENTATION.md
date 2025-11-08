# Frontend Implementation Guide

> **Document Processor Backend API** - Integration guide for frontend developers

This guide provides everything you need to integrate your frontend application with the Document Processor Backend API.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [API Base URL](#api-base-url)
- [Authentication](#authentication)
- [Core API Endpoints](#core-api-endpoints)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Complete Workflow Example](#complete-workflow-example)
- [Best Practices](#best-practices)
- [Rate Limiting](#rate-limiting)
- [CORS Configuration](#cors-configuration)
- [FAQ](#faq)

---

## Quick Start

### 1. Backend URL

```bash
# Development
http://localhost:3000

# API Base Path
http://localhost:3000/api
```

### 2. Basic Upload & Process Flow

```javascript
// Upload files
const formData = new FormData();
formData.append('files', fileObject);

const response = await fetch('http://localhost:3000/api/wizard/upload', {
  method: 'POST',
  body: formData
});

const { data } = await response.json();
const { sessionId } = data;

// Submit processing prompts
await fetch('http://localhost:3000/api/wizard/prompts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    prompts: [{
      content: 'Extract all financial data',
      priority: 1,
      targetType: 'GLOBAL'
    }]
  })
});

// Poll for completion
const checkStatus = async () => {
  const res = await fetch(`http://localhost:3000/api/wizard/status/${sessionId}`);
  const { data } = await res.json();
  return data.status; // 'PROCESSING' | 'COMPLETED' | 'FAILED'
};
```

---

## Environment Setup

### Frontend Environment Variables

Create a `.env` file in your frontend project:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api
# or for React: REACT_APP_API_BASE_URL=http://localhost:3000/api
# or for Next.js: NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

# Polling Configuration
VITE_POLLING_INTERVAL=3000  # milliseconds

# File Upload Limits
VITE_MAX_FILE_SIZE=52428800  # 50MB in bytes
VITE_MAX_FILES=10
```

### Supported File Types

- **Documents**: `.pdf`, `.docx`, `.doc`
- **Spreadsheets**: `.xlsx`, `.xls`
- **Max file size**: 50MB per file
- **Max files per upload**: 10 files

---

## API Base URL

All API endpoints are prefixed with `/api`:

```
Base: http://localhost:3000/api
```

Example endpoints:
- `POST /api/wizard/upload`
- `GET /api/wizard/status/:sessionId`
- `GET /api/health`

---

## Authentication

### Current Implementation

**⚠️ No authentication required** in the current version.

All endpoints are publicly accessible.

### Future Implementation

The production version will require JWT authentication:

```javascript
// Future implementation example
headers: {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
}
```

---

## Core API Endpoints

### 1. Upload Files

Start a new document processing session by uploading files.

**Endpoint**: `POST /api/wizard/upload`

**Content-Type**: `multipart/form-data`

**Request**:

```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('userId', 'optional-user-id');  // optional
formData.append('metadata', JSON.stringify({ key: 'value' }));  // optional

const response = await fetch(`${API_BASE_URL}/wizard/upload`, {
  method: 'POST',
  body: formData
});
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "files": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "filename": "document.pdf",
        "mimeType": "application/pdf",
        "size": 1048576,
        "tokenCount": 5000,
        "sections": [
          {
            "title": "Introduction",
            "level": 1,
            "startLine": 1,
            "endLine": 50,
            "content": "Section content..."
          }
        ],
        "tables": [
          {
            "startLine": 100,
            "endLine": 120,
            "headers": ["Column1", "Column2"],
            "rows": [["Value1", "Value2"]],
            "markdown": "| Column1 | Column2 |\n|---------|---------|..."
          }
        ]
      }
    ],
    "totalTokens": 5000,
    "recommendedModel": "llama3.1:8b"
  }
}
```

---

### 2. Submit Processing Prompts

Define what you want the AI to do with the uploaded documents.

**Endpoint**: `POST /api/wizard/prompts`

**Content-Type**: `application/json`

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/prompts`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    prompts: [
      {
        content: "Extract all revenue figures",
        priority: 1,
        targetType: "GLOBAL"
      },
      {
        content: "Summarize the executive summary section",
        priority: 2,
        targetType: "SECTION_SPECIFIC",
        targetSection: "Executive Summary"
      },
      {
        content: "Analyze this specific file",
        priority: 3,
        targetType: "FILE_SPECIFIC",
        targetFileId: "660e8400-e29b-41d4-a716-446655440001"
      },
      {
        content: "Extract data from these lines",
        priority: 4,
        targetType: "LINE_SPECIFIC",
        targetFileId: "660e8400-e29b-41d4-a716-446655440001",
        targetLines: { start: 10, end: 50 }
      }
    ]
  })
});
```

**Prompt Target Types**:

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `GLOBAL` | Process all files | `content`, `priority` |
| `FILE_SPECIFIC` | Target a specific file | `content`, `priority`, `targetFileId` |
| `LINE_SPECIFIC` | Target specific line range | `content`, `priority`, `targetFileId`, `targetLines` |
| `SECTION_SPECIFIC` | Target a named section | `content`, `priority`, `targetSection` |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "4 prompts added successfully",
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "PROCESSING"
    }
  }
}
```

---

### 3. Check Processing Status

Poll this endpoint to monitor processing progress.

**Endpoint**: `GET /api/wizard/status/:sessionId`

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/status/${sessionId}`);
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PROCESSING",
    "progress": {
      "total": 4,
      "completed": 2,
      "pending": 1,
      "processing": 1,
      "failed": 0,
      "skipped": 0,
      "percentage": 50
    },
    "hasClarifications": true,
    "pendingClarifications": 1,
    "hasResult": false,
    "createdAt": "2025-11-08T10:00:00.000Z",
    "expiresAt": "2025-11-08T11:00:00.000Z"
  }
}
```

**Status Values**:
- `ACTIVE` - Session created, ready for prompts
- `PROCESSING` - AI is processing prompts
- `COMPLETED` - All processing finished successfully
- `FAILED` - Processing failed with errors
- `EXPIRED` - Session expired (default: 1 hour)

---

### 4. Get Clarification Questions

When `hasClarifications` is true, fetch pending AI questions.

**Endpoint**: `GET /api/wizard/clarifications/:sessionId`

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/clarifications/${sessionId}`);
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "clarifications": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "type": "CLARIFICATION",
        "role": "ASSISTANT",
        "content": "I found multiple revenue values. Which one should I use: Q1 ($500k) or Q2 ($750k)?",
        "context": {
          "promptId": "880e8400-e29b-41d4-a716-446655440000",
          "relatedData": ["Q1: $500k", "Q2: $750k"]
        },
        "createdAt": "2025-11-08T10:05:00.000Z"
      }
    ]
  }
}
```

---

### 5. Respond to Clarifications

Answer the AI's questions to continue processing.

**Endpoint**: `POST /api/wizard/clarifications/respond`

**Content-Type**: `application/json`

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/clarifications/respond`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    clarificationId: "770e8400-e29b-41d4-a716-446655440000",
    response: "Use the Q2 value ($750k)"
  })
});
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Clarification response recorded"
  }
}
```

---

### 6. Retrieve Results

Get the processed document result.

**Endpoint**: `GET /api/wizard/result/:sessionId`

**Query Parameters**:
- `version` (optional): Specific version number (defaults to latest)

**Request**:

```javascript
// Latest version
const response = await fetch(`${API_BASE_URL}/wizard/result/${sessionId}`);

// Specific version
const response = await fetch(`${API_BASE_URL}/wizard/result/${sessionId}?version=2`);
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "result": {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "version": 1,
      "content": "# Processed Document\n\n## Revenue Analysis\n\nTotal revenue: $750,000...",
      "format": "markdown",
      "status": "PENDING_CONFIRMATION",
      "metadata": {
        "sectionsProcessed": 5,
        "totalLines": 1000
      },
      "aiProvider": "ollama",
      "modelUsed": "llama3.1:8b",
      "tokensUsed": 8500,
      "createdAt": "2025-11-08T10:10:00.000Z"
    },
    "availableVersions": [1],
    "isLatest": true
  }
}
```

---

### 7. Confirm or Regenerate Result

Accept the result, request modifications, or regenerate.

**Endpoint**: `POST /api/wizard/result/confirm`

**Content-Type**: `application/json`

**Request**:

```javascript
// Confirm result
const response = await fetch(`${API_BASE_URL}/wizard/result/confirm`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    resultId: "990e8400-e29b-41d4-a716-446655440000",
    action: "CONFIRM"  // or "MODIFY" or "REGENERATE"
  })
});
```

**Actions**:
- `CONFIRM` - Accept the result as final
- `MODIFY` - Request modifications (use with `/result/modify`)
- `REGENERATE` - Start processing from scratch

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Result confirmed",
    "result": {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "status": "CONFIRMED",
      "confirmedAt": "2025-11-08T10:15:00.000Z"
    }
  }
}
```

---

### 8. Modify Result

Request changes to the generated result.

**Endpoint**: `POST /api/wizard/result/modify`

**Content-Type**: `application/json`

**Two modification modes**:

#### A. Direct Edit (Provide Modified Content)

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/result/modify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    resultId: "990e8400-e29b-41d4-a716-446655440000",
    modifications: "# Updated Document\n\n## Revenue Analysis\n\n..."
  })
});
```

#### B. AI Modification (Provide New Prompts)

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/result/modify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    resultId: "990e8400-e29b-41d4-a716-446655440000",
    modifications: [
      {
        content: "Add a summary section at the beginning",
        priority: 1
      },
      {
        content: "Format all numbers with commas",
        priority: 2
      }
    ]
  })
});
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "message": "Modification request submitted",
    "newVersion": 2,
    "session": {
      "status": "PROCESSING"
    }
  }
}
```

---

### 9. Get Conversation History

Retrieve the full conversation thread including clarifications.

**Endpoint**: `GET /api/wizard/conversation/:sessionId`

**Query Parameters**:
- `limit` (optional): Limit number of messages returned

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/conversation/${sessionId}?limit=50`);
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "conversation": [
      {
        "id": "conv1",
        "type": "GENERAL",
        "role": "SYSTEM",
        "content": "Session started",
        "createdAt": "2025-11-08T10:00:00.000Z"
      },
      {
        "id": "conv2",
        "type": "CLARIFICATION",
        "role": "ASSISTANT",
        "content": "Which revenue value should I use?",
        "createdAt": "2025-11-08T10:05:00.000Z"
      },
      {
        "id": "conv3",
        "type": "CLARIFICATION",
        "role": "USER",
        "content": "Use Q2 value",
        "createdAt": "2025-11-08T10:06:00.000Z"
      }
    ]
  }
}
```

---

### 10. Get Session Details

Retrieve complete session information.

**Endpoint**: `GET /api/wizard/session/:sessionId`

**Request**:

```javascript
const response = await fetch(`${API_BASE_URL}/wizard/session/${sessionId}`);
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user123",
      "status": "COMPLETED",
      "createdAt": "2025-11-08T10:00:00.000Z",
      "expiresAt": "2025-11-08T11:00:00.000Z",
      "metadata": { "key": "value" },
      "files": [...],
      "prompts": [...],
      "results": [...]
    }
  }
}
```

---

### 11. Health Check

Check if the backend is running.

**Endpoint**: `GET /health`

**Request**:

```javascript
const response = await fetch('http://localhost:3000/health');
```

**Response** (200 OK):

```json
{
  "status": "ok",
  "timestamp": "2025-11-08T10:00:00.000Z",
  "uptime": 3600,
  "environment": "development"
}
```

---

## Data Models

### Session

```typescript
interface Session {
  id: string;                    // UUID
  userId?: string;               // Optional user identifier
  status: SessionStatus;         // Current status
  createdAt: Date;
  expiresAt: Date;              // Default: 1 hour from creation
  metadata?: Record<string, any>;
}

type SessionStatus =
  | 'ACTIVE'       // Created, ready for prompts
  | 'PROCESSING'   // AI is working
  | 'COMPLETED'    // Finished successfully
  | 'FAILED'       // Processing failed
  | 'EXPIRED';     // Session timeout
```

### File

```typescript
interface File {
  id: string;                    // UUID
  filename: string;              // Original filename
  mimeType: string;              // MIME type
  size: number;                  // File size in bytes
  tokenCount: number;            // Estimated tokens
  sections: Section[];           // Detected sections
  tables: Table[];               // Detected tables
}

interface Section {
  title: string;                 // Section heading
  level: number;                 // Heading level (1-6)
  startLine: number;
  endLine: number;
  content: string;               // Section text
}

interface Table {
  startLine: number;
  endLine: number;
  headers: string[];             // Column headers
  rows: string[][];              // Table data
  markdown: string;              // Markdown representation
}
```

### Prompt

```typescript
interface Prompt {
  id: string;                    // UUID
  content: string;               // The instruction (1-10000 chars)
  priority: number;              // Lower = higher priority
  targetType: TargetType;
  targetFileId?: string;         // Required for FILE_SPECIFIC, LINE_SPECIFIC
  targetLines?: LineRange;       // Required for LINE_SPECIFIC
  targetSection?: string;        // Required for SECTION_SPECIFIC
  status: PromptStatus;
  executionOrder?: number;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

type TargetType =
  | 'GLOBAL'           // All files
  | 'FILE_SPECIFIC'    // Single file
  | 'LINE_SPECIFIC'    // Line range in a file
  | 'SECTION_SPECIFIC'; // Named section

type PromptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

interface LineRange {
  start: number;
  end: number;
}
```

### Result

```typescript
interface Result {
  id: string;                    // UUID
  version: number;               // Version number (1, 2, 3...)
  content: string;               // Markdown formatted result
  format: 'markdown';            // Output format
  status: ResultStatus;
  metadata?: Record<string, any>;
  aiProvider?: string;           // 'ollama' | 'openai' | 'gemini'
  modelUsed?: string;            // Model name
  tokensUsed?: number;           // Total tokens consumed
  createdAt: Date;
  confirmedAt?: Date;
}

type ResultStatus =
  | 'DRAFT'               // Initial creation
  | 'PENDING_CONFIRMATION' // Awaiting user confirmation
  | 'CONFIRMED'           // User approved
  | 'MODIFIED';           // User made changes
```

### Clarification (Conversation)

```typescript
interface Clarification {
  id: string;                    // UUID
  type: ConversationType;
  role: ConversationRole;
  content: string;               // Message content
  context?: Record<string, any>; // Additional context
  createdAt: Date;
}

type ConversationType =
  | 'CLARIFICATION'    // AI asking for input
  | 'MODIFICATION'     // Modification request
  | 'GENERAL';         // System messages

type ConversationRole =
  | 'USER'             // User message
  | 'ASSISTANT'        // AI message
  | 'SYSTEM';          // System message
```

---

## Error Handling

### Response Format

**Success**:
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

**Error**:
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Or (from error middleware):
```json
{
  "error": "ValidationError",
  "message": "Detailed error message",
  "stack": "..." // Only in development mode
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Success | Request completed successfully |
| `400` | Bad Request | Invalid request parameters, validation errors |
| `404` | Not Found | Session/resource not found or expired |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

### Common Errors

```javascript
// Missing files
{
  "success": false,
  "error": "No files uploaded"
}

// Validation error
{
  "success": false,
  "error": "Validation error: prompts is required"
}

// Session not found
{
  "success": false,
  "error": "Session not found or expired"
}

// Invalid file type
{
  "success": false,
  "error": "File type .xyz not allowed. Allowed types: .pdf, .docx, .xlsx, .doc, .xls"
}

// Rate limit
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

### Error Handling Example

```javascript
async function uploadFiles(files) {
  try {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch(`${API_BASE_URL}/wizard/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.data;

  } catch (error) {
    console.error('Upload error:', error);

    // Handle specific errors
    if (error.message.includes('not allowed')) {
      alert('Invalid file type. Please upload PDF, DOCX, or XLSX files.');
    } else if (error.message.includes('Too many requests')) {
      alert('Rate limit exceeded. Please wait a moment and try again.');
    } else {
      alert(`Upload failed: ${error.message}`);
    }

    throw error;
  }
}
```

---

## Complete Workflow Example

### React/TypeScript Implementation

```typescript
import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface UploadResponse {
  sessionId: string;
  files: any[];
  totalTokens: number;
}

interface StatusResponse {
  status: string;
  progress: {
    percentage: number;
    completed: number;
    total: number;
  };
  hasClarifications: boolean;
  hasResult: boolean;
}

function DocumentProcessor() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<any[]>([]);

  // 1. Upload files
  const handleUpload = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API_BASE_URL}/wizard/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setSessionId(data.data.sessionId);
      return data.data;

    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  // 2. Submit prompts
  const submitPrompts = async (prompts: any[]) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/wizard/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompts })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      // Start polling
      startPolling();

    } catch (error) {
      console.error('Submit prompts failed:', error);
      throw error;
    }
  };

  // 3. Poll for status
  const startPolling = () => {
    const pollInterval = setInterval(async () => {
      if (!sessionId) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/wizard/status/${sessionId}`);
        const data = await response.json();

        if (!data.success) {
          clearInterval(pollInterval);
          return;
        }

        setStatus(data.data);

        // Check for clarifications
        if (data.data.hasClarifications) {
          await fetchClarifications();
        }

        // Check if completed
        if (data.data.status === 'COMPLETED') {
          clearInterval(pollInterval);
          await fetchResult();
        }

        // Check if failed
        if (data.data.status === 'FAILED') {
          clearInterval(pollInterval);
          console.error('Processing failed');
        }

      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  };

  // 4. Fetch clarifications
  const fetchClarifications = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/wizard/clarifications/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setClarifications(data.data.clarifications);
      }
    } catch (error) {
      console.error('Fetch clarifications failed:', error);
    }
  };

  // 5. Respond to clarification
  const respondToClarification = async (clarificationId: string, response: string) => {
    if (!sessionId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/wizard/clarifications/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          clarificationId,
          response
        })
      });

      const data = await res.json();

      if (data.success) {
        // Remove answered clarification
        setClarifications(prev =>
          prev.filter(c => c.id !== clarificationId)
        );
      }
    } catch (error) {
      console.error('Respond to clarification failed:', error);
    }
  };

  // 6. Fetch result
  const fetchResult = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/wizard/result/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setResult(data.data.result.content);
      }
    } catch (error) {
      console.error('Fetch result failed:', error);
    }
  };

  // 7. Confirm result
  const confirmResult = async (resultId: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/wizard/result/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          resultId,
          action: 'CONFIRM'
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('Result confirmed!');
      }
    } catch (error) {
      console.error('Confirm result failed:', error);
    }
  };

  return (
    <div>
      <h1>Document Processor</h1>

      {/* File upload */}
      <input
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      {/* Status display */}
      {status && (
        <div>
          <p>Status: {status.status}</p>
          <p>Progress: {status.progress.percentage}%</p>
        </div>
      )}

      {/* Clarifications */}
      {clarifications.map(clarification => (
        <div key={clarification.id}>
          <p>{clarification.content}</p>
          <button onClick={() => {
            const answer = prompt('Your answer:');
            if (answer) respondToClarification(clarification.id, answer);
          }}>
            Answer
          </button>
        </div>
      ))}

      {/* Result display */}
      {result && (
        <div>
          <h2>Result</h2>
          <div dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      )}
    </div>
  );
}

export default DocumentProcessor;
```

---

## Best Practices

### 1. Polling Strategy

**Recommended Approach**:

```javascript
// Adaptive polling based on status
function getPollingInterval(status) {
  switch (status) {
    case 'PROCESSING':
      return 3000;  // 3 seconds during active processing
    case 'ACTIVE':
      return 5000;  // 5 seconds when idle
    default:
      return 10000; // 10 seconds for other states
  }
}

// Implement exponential backoff on errors
let errorCount = 0;

async function pollWithBackoff() {
  try {
    const response = await fetch(`/api/wizard/status/${sessionId}`);
    errorCount = 0; // Reset on success

  } catch (error) {
    errorCount++;
    const backoffTime = Math.min(1000 * Math.pow(2, errorCount), 30000);
    await new Promise(resolve => setTimeout(resolve, backoffTime));
  }
}
```

### 2. File Validation

```javascript
function validateFile(file) {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ];

  if (file.size > MAX_SIZE) {
    throw new Error(`File ${file.name} exceeds 50MB limit`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File ${file.name} has unsupported type`);
  }

  return true;
}

// Usage
function handleFiles(files) {
  const validFiles = [];

  for (const file of files) {
    try {
      validateFile(file);
      validFiles.push(file);
    } catch (error) {
      console.error(error.message);
    }
  }

  return validFiles;
}
```

### 3. Session Management

```javascript
// Store session ID in localStorage for recovery
function saveSession(sessionId) {
  localStorage.setItem('currentSession', sessionId);
  localStorage.setItem('sessionTimestamp', Date.now().toString());
}

// Recover session on page reload
function recoverSession() {
  const sessionId = localStorage.getItem('currentSession');
  const timestamp = localStorage.getItem('sessionTimestamp');

  if (!sessionId || !timestamp) return null;

  // Check if session expired (1 hour default)
  const age = Date.now() - parseInt(timestamp);
  const ONE_HOUR = 60 * 60 * 1000;

  if (age > ONE_HOUR) {
    localStorage.removeItem('currentSession');
    localStorage.removeItem('sessionTimestamp');
    return null;
  }

  return sessionId;
}
```

### 4. Progress Tracking

```javascript
// Calculate overall progress
function calculateProgress(status) {
  const { completed, total, failed, skipped } = status.progress;

  return {
    percentage: status.progress.percentage,
    message: `Processed ${completed}/${total} prompts`,
    details: {
      successful: completed,
      failed: failed,
      skipped: skipped,
      remaining: total - completed - failed - skipped
    }
  };
}
```

### 5. Error Recovery

```javascript
async function retryableRequest(fn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage
const data = await retryableRequest(() =>
  fetch(`${API_BASE_URL}/wizard/status/${sessionId}`)
    .then(res => res.json())
);
```

---

## Rate Limiting

### Rate Limit Details

- **Window**: 15 minutes (900,000ms)
- **Max Requests**: 100 requests per window per IP address

### Response Headers

Monitor these headers to track your rate limit status:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699459200
```

### Handling Rate Limits

```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');

  if (remaining < 10) {
    console.warn(`Rate limit warning: ${remaining} requests remaining`);
  }

  if (response.status === 429) {
    const resetDate = new Date(reset * 1000);
    throw new Error(`Rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}`);
  }

  return response;
}
```

---

## CORS Configuration

### Current Setup

The backend has CORS **fully enabled** with default settings:

- **Allowed Origins**: All (`*`)
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: All

### Production Considerations

For production deployments, CORS should be restricted:

```javascript
// Backend configuration (for reference)
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## FAQ

### Q: How long do sessions last?

**A**: Sessions expire after **1 hour** (3600 seconds) by default. Plan your workflows accordingly or implement session renewal.

---

### Q: Can I upload files larger than 50MB?

**A**: No, the backend enforces a 50MB limit per file. Consider splitting large documents or compressing files before upload.

---

### Q: Do I need to implement WebSocket for real-time updates?

**A**: No, WebSocket support is not yet available. Use **polling** with the `/api/wizard/status/:sessionId` endpoint (recommended: every 3-5 seconds).

---

### Q: What happens if I don't answer a clarification?

**A**: Processing will pause until you respond. The session will eventually expire (1 hour) if left unanswered.

---

### Q: Can I modify a result multiple times?

**A**: Yes! Each modification creates a new version. You can access previous versions using the `version` query parameter.

---

### Q: How do I handle markdown results?

**A**: Use a markdown parser like `marked`, `react-markdown`, or `markdown-it`:

```javascript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{result.content}</ReactMarkdown>
```

---

### Q: What AI models are supported?

**A**: The backend supports:
- **Ollama** (local models like Llama 3.1)
- **OpenAI** (GPT-4, GPT-3.5)
- **Google Gemini** (Gemini Flash)

The recommended model is automatically selected based on your uploaded documents.

---

### Q: Is authentication required?

**A**: Currently **no**, but production deployments should implement JWT or OAuth authentication for security.

---

### Q: Can I cancel a processing session?

**A**: Not directly. Sessions will timeout after 1 hour, or you can simply stop polling and start a new session.

---

### Q: How do I test the API?

**A**: Use the built-in Swagger UI at `http://localhost:3000/api-docs` for interactive API testing.

---

## Additional Resources

- **API Documentation**: See `API.md` in the backend repository
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Backend Setup**: See `SETUP.md` for backend installation
- **Example Usage**: See `EXAMPLE.md` for detailed examples

---

## Support

For issues or questions:

1. Check the backend logs for detailed error messages
2. Review the Swagger documentation at `/api-docs`
3. Verify your environment variables are correctly set
4. Ensure the backend services (PostgreSQL, Redis, Ollama) are running

---

**Last Updated**: November 2025
**Backend Version**: Check `package.json` for current version
