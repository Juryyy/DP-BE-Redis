/**
 * General application constants
 */

// File upload limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const MAX_JSON_SIZE = '10mb';

// Session configuration
export const DEFAULT_SESSION_EXPIRE_SECONDS = 3600; // 1 hour

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 900000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Cleanup intervals
export const SESSION_CLEANUP_INTERVAL_MS = 3600000; // 1 hour

// Graceful shutdown timeout
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds

// Supported file types
export const SUPPORTED_MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
} as const;

export const SUPPORTED_FILE_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.doc', '.xls'] as const;

// Processing queue configuration
export const MAX_CONCURRENT_PROCESSING = 5; // Maximum number of concurrent processing jobs
export const QUEUE_POLL_INTERVAL_MS = 1000; // How often to check queue (1 second)
