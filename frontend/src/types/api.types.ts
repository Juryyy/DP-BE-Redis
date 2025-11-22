/**
 * API response types
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
}
