/**
 * Wizard Store - Main store for document processing wizard state
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Session,
  FileMetadata,
  Prompt,
  PromptInput,
  Result,
  Clarification,
  TokenEstimate,
  Progress,
} from 'src/types/api.types';
import * as api from 'src/services/api.service';

export const useWizardStore = defineStore('wizard', () => {
  // ==================== STATE ====================

  // Session
  const sessionId = ref<string | null>(null);
  const sessionStatus = ref<Session['status']>('ACTIVE');
  const sessionExpiresAt = ref<string | null>(null);

  // Files
  const uploadedFiles = ref<FileMetadata[]>([]);
  const localFiles = ref<File[]>([]); // Keep local file objects for preview
  const tokenEstimate = ref<TokenEstimate | null>(null);

  // Prompts
  const prompts = ref<Prompt[]>([]);
  const promptsInput = ref<PromptInput[]>([]);

  // Progress
  const progress = ref<Progress>({
    total: 0,
    completed: 0,
    processing: 0,
    pending: 0,
    failed: 0,
    percentage: 0,
  });

  // Clarifications
  const clarifications = ref<Clarification[]>([]);
  const hasClarifications = ref(false);

  // Results
  const result = ref<Result | null>(null);
  const hasResult = ref(false);

  // UI State
  const currentStep = ref(1);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isPolling = ref(false);

  // ==================== GETTERS ====================

  const canProceedToStep2 = computed(() => uploadedFiles.value.length > 0);
  const canProceedToStep3 = computed(() => promptsInput.value.length > 0);
  const isProcessing = computed(() => sessionStatus.value === 'PROCESSING');
  const isCompleted = computed(() => sessionStatus.value === 'COMPLETED');
  const hasPendingClarifications = computed(() => clarifications.value.length > 0);
  const totalSteps = computed(() => (hasClarifications.value ? 6 : 5));

  // ==================== ACTIONS ====================

  /**
   * Upload files and create session
   */
  async function uploadFiles(files: File[], userId?: string) {
    try {
      isLoading.value = true;
      error.value = null;

      // Store local files for preview
      localFiles.value = files;

      const response = await api.uploadFiles(files, userId);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Upload failed');
      }

      sessionId.value = response.data.sessionId;
      uploadedFiles.value = response.data.files;
      tokenEstimate.value = response.data.tokenEstimate || null;
      sessionExpiresAt.value = response.data.expiresAt;

      // Save session to localStorage for recovery
      saveSessionToStorage();

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Upload failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Submit prompts for processing
   */
  async function submitPrompts(promptsToSubmit: PromptInput[]) {
    try {
      if (!sessionId.value) {
        throw new Error('No active session');
      }

      isLoading.value = true;
      error.value = null;

      const response = await api.submitPrompts({
        sessionId: sessionId.value,
        prompts: promptsToSubmit,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to submit prompts');
      }

      prompts.value = response.data.prompts;
      promptsInput.value = promptsToSubmit;
      sessionStatus.value = 'PROCESSING';

      // Start polling for status
      startPolling();

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit prompts';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get current processing status
   */
  async function fetchStatus() {
    try {
      if (!sessionId.value) {
        throw new Error('No active session');
      }

      const response = await api.getStatus(sessionId.value);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch status');
      }

      const data = response.data;

      sessionStatus.value = data.status;
      progress.value = data.progress;
      hasClarifications.value = data.hasClarifications;
      hasResult.value = data.hasResult;

      // Fetch clarifications if any
      if (data.hasClarifications) {
        await fetchClarifications();
      }

      // Fetch result if available
      if (data.hasResult && data.result) {
        result.value = data.result;
      }

      return data;
    } catch (err) {
      console.error('Failed to fetch status:', err);
      // Don't throw error during polling
    }
  }

  /**
   * Get pending clarifications
   */
  async function fetchClarifications() {
    try {
      if (!sessionId.value) {
        throw new Error('No active session');
      }

      const response = await api.getClarifications(sessionId.value);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch clarifications');
      }

      clarifications.value = response.data.clarifications;

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch clarifications';
      throw err;
    }
  }

  /**
   * Respond to a clarification
   */
  async function respondToClarification(clarificationId: string, responseText: string) {
    try {
      if (!sessionId.value) {
        throw new Error('No active session');
      }

      isLoading.value = true;
      error.value = null;

      const response = await api.respondToClarification({
        sessionId: sessionId.value,
        clarificationId,
        response: responseText,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to respond to clarification');
      }

      // Remove answered clarification
      clarifications.value = clarifications.value.filter((c) => c.id !== clarificationId);

      // Continue polling if still processing
      if (sessionStatus.value === 'PROCESSING') {
        startPolling();
      }

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to respond to clarification';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch result
   */
  async function fetchResult(version?: number) {
    try {
      if (!sessionId.value) {
        throw new Error('No active session');
      }

      isLoading.value = true;
      error.value = null;

      const response = await api.getResult(sessionId.value, version);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch result');
      }

      result.value = response.data.result;
      hasResult.value = true;

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch result';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Confirm result
   */
  async function confirmResult(action: 'CONFIRM' | 'MODIFY' | 'REGENERATE') {
    try {
      if (!sessionId.value || !result.value) {
        throw new Error('No active session or result');
      }

      isLoading.value = true;
      error.value = null;

      const response = await api.confirmResult({
        sessionId: sessionId.value,
        resultId: result.value.id,
        action,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to confirm result');
      }

      if (action === 'CONFIRM') {
        sessionStatus.value = 'COMPLETED';
      } else if (action === 'REGENERATE') {
        sessionStatus.value = 'PROCESSING';
        startPolling();
      }

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to confirm result';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Modify result
   */
  async function modifyResult(modifications: string | PromptInput[]) {
    try {
      if (!sessionId.value || !result.value) {
        throw new Error('No active session or result');
      }

      isLoading.value = true;
      error.value = null;

      const response = await api.modifyResult({
        sessionId: sessionId.value,
        resultId: result.value.id,
        modifications,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to modify result');
      }

      if (response.data?.result) {
        result.value = response.data.result;
      }

      // Start polling if processing
      if (response.data?.status === 'processing_modifications') {
        sessionStatus.value = 'PROCESSING';
        startPolling();
      }

      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to modify result';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Start polling for status updates
   */
  let pollingInterval: NodeJS.Timeout | null = null;

  function startPolling() {
    if (isPolling.value || pollingInterval) {
      return;
    }

    isPolling.value = true;

    const interval = parseInt(import.meta.env.VITE_POLLING_INTERVAL || '3000', 10);

    pollingInterval = setInterval(() => {
      void fetchStatus()
        .then(() => {
          if (sessionStatus.value === 'COMPLETED' || sessionStatus.value === 'FAILED') {
            stopPolling();
          }

          if (hasPendingClarifications.value) {
            stopPolling();
          }
        })
        .catch((err) => {
          console.error('Polling fetchStatus error:', err);
        });
    }, interval);
  }

  /**
   * Stop polling
   */
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    isPolling.value = false;
  }

  /**
   * Navigate to step
   */
  function goToStep(step: number) {
    currentStep.value = step;
  }

  /**
   * Reset wizard state
   */
  function reset() {
    stopPolling();
    sessionId.value = null;
    sessionStatus.value = 'ACTIVE';
    sessionExpiresAt.value = null;
    uploadedFiles.value = [];
    localFiles.value = [];
    tokenEstimate.value = null;
    prompts.value = [];
    promptsInput.value = [];
    progress.value = {
      total: 0,
      completed: 0,
      processing: 0,
      pending: 0,
      failed: 0,
      percentage: 0,
    };
    clarifications.value = [];
    hasClarifications.value = false;
    result.value = null;
    hasResult.value = false;
    currentStep.value = 1;
    error.value = null;
    clearSessionFromStorage();
  }

  /**
   * Save session to localStorage
   */
  function saveSessionToStorage() {
    if (sessionId.value) {
      localStorage.setItem('dp_sessionId', sessionId.value);
      localStorage.setItem('dp_sessionTimestamp', Date.now().toString());
    }
  }

  /**
   * Load session from localStorage
   */
  function loadSessionFromStorage() {
    const savedSessionId = localStorage.getItem('dp_sessionId');
    const timestamp = localStorage.getItem('dp_sessionTimestamp');

    if (!savedSessionId || !timestamp) {
      return null;
    }

    // Check if session expired (1 hour default)
    const age = Date.now() - parseInt(timestamp, 10);
    const ONE_HOUR = 60 * 60 * 1000;

    if (age > ONE_HOUR) {
      clearSessionFromStorage();
      return null;
    }

    sessionId.value = savedSessionId;
    return savedSessionId;
  }

  /**
   * Clear session from localStorage
   */
  function clearSessionFromStorage() {
    localStorage.removeItem('dp_sessionId');
    localStorage.removeItem('dp_sessionTimestamp');
  }

  return {
    // State
    sessionId,
    sessionStatus,
    sessionExpiresAt,
    uploadedFiles,
    localFiles,
    tokenEstimate,
    prompts,
    promptsInput,
    progress,
    clarifications,
    hasClarifications,
    result,
    hasResult,
    currentStep,
    isLoading,
    error,
    isPolling,

    // Getters
    canProceedToStep2,
    canProceedToStep3,
    isProcessing,
    isCompleted,
    hasPendingClarifications,
    totalSteps,

    // Actions
    uploadFiles,
    submitPrompts,
    fetchStatus,
    fetchClarifications,
    respondToClarification,
    fetchResult,
    confirmResult,
    modifyResult,
    startPolling,
    stopPolling,
    goToStep,
    reset,
    loadSessionFromStorage,
  };
});
