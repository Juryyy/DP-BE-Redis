/**
 * API Service Layer for Document Processing Wizard
 * Handles all HTTP communication with the backend
 */

import { api } from 'boot/axios';
import type {
  ApiResponse,
  UploadResponse,
  SubmitPromptsRequest,
  SubmitPromptsResponse,
  StatusResponse,
  ClarificationsResponse,
  ClarificationResponseRequest,
  ResultResponse,
  ConfirmResultRequest,
  ConfirmResultResponse,
  ModifyResultRequest,
  ModifyResultResponse,
} from 'src/types/api.types';

const API_BASE = '/wizard';

/**
 * Upload files to start a new session
 */
export async function uploadFiles(
  files: File[],
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<ApiResponse<UploadResponse>> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  if (userId) {
    formData.append('userId', userId);
  }

  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await api.post<ApiResponse<UploadResponse>>(
    `${API_BASE}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data;
}

/**
 * Submit processing prompts
 */
export async function submitPrompts(
  request: SubmitPromptsRequest
): Promise<ApiResponse<SubmitPromptsResponse>> {
  const response = await api.post<ApiResponse<SubmitPromptsResponse>>(
    `${API_BASE}/prompts`,
    request
  );

  return response.data;
}

/**
 * Get processing status
 */
export async function getStatus(
  sessionId: string
): Promise<ApiResponse<StatusResponse>> {
  const response = await api.get<ApiResponse<StatusResponse>>(
    `${API_BASE}/status/${sessionId}`
  );

  return response.data;
}

/**
 * Get pending clarifications
 */
export async function getClarifications(
  sessionId: string
): Promise<ApiResponse<ClarificationsResponse>> {
  const response = await api.get<ApiResponse<ClarificationsResponse>>(
    `${API_BASE}/clarifications/${sessionId}`
  );

  return response.data;
}

/**
 * Respond to a clarification
 */
export async function respondToClarification(
  request: ClarificationResponseRequest
): Promise<ApiResponse<{ status: string }>> {
  const response = await api.post<ApiResponse<{ status: string }>>(
    `${API_BASE}/clarifications/respond`,
    request
  );

  return response.data;
}

/**
 * Get result
 */
export async function getResult(
  sessionId: string,
  version?: number
): Promise<ApiResponse<ResultResponse>> {
  const params = version ? { version } : {};

  const response = await api.get<ApiResponse<ResultResponse>>(
    `${API_BASE}/result/${sessionId}`,
    { params }
  );

  return response.data;
}

/**
 * Confirm, modify, or regenerate a result
 */
export async function confirmResult(
  request: ConfirmResultRequest
): Promise<ApiResponse<ConfirmResultResponse>> {
  const response = await api.post<ApiResponse<ConfirmResultResponse>>(
    `${API_BASE}/result/confirm`,
    request
  );

  return response.data;
}

/**
 * Modify a result with new content or prompts
 */
export async function modifyResult(
  request: ModifyResultRequest
): Promise<ApiResponse<ModifyResultResponse>> {
  const response = await api.post<ApiResponse<ModifyResultResponse>>(
    `${API_BASE}/result/modify`,
    request
  );

  return response.data;
}

/**
 * Get conversation history
 */
export async function getConversation(
  sessionId: string,
  limit?: number
): Promise<ApiResponse<{ conversation: unknown[] }>> {
  const params = limit ? { limit } : {};

  const response = await api.get<ApiResponse<{ conversation: unknown[] }>>(
    `${API_BASE}/conversation/${sessionId}`,
    { params }
  );

  return response.data;
}

/**
 * Get session details
 */
export async function getSession(
  sessionId: string
): Promise<ApiResponse<{ session: unknown }>> {
  const response = await api.get<ApiResponse<{ session: unknown }>>(
    `${API_BASE}/session/${sessionId}`
  );

  return response.data;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}> {
  const response = await api.get('/health');
  return response.data;
}
