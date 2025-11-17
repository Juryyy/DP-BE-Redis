import { defineStore } from 'pinia';
import { api } from 'boot/axios';
import type {
  AIProvider,
  AIProviders,
  ProviderOptions,
  ApiError
} from 'src/types/ai.types';
import type { UploadedFile } from 'src/types/file.types';
import type {
  ProcessingMode,
  OutputFormat,
  AdditionalSettings,
  ProcessingResult
} from 'src/types/wizard.types';

export interface WizardState {
  // Session
  sessionId: string | null;
  currentStep: number;

  // Step 1: Files
  uploadedFiles: UploadedFile[];

  // Step 2: AI Configuration
  providers: AIProviders;
  selectedProvider: string;
  selectedModel: string;
  apiKeys: Record<string, string>;
  providerOptions: ProviderOptions;

  // Step 3: Prompt
  promptText: string;
  selectedTemplate: string | null;

  // Step 4: Processing Options
  processingMode: ProcessingMode;
  outputFormat: OutputFormat;
  additionalSettings: AdditionalSettings;

  // Step 5: Results
  result: ProcessingResult | null;

  // UI State
  isLoading: boolean;
  error: string | null;
}

// Re-export types for convenience
export type { AIProvider, UploadedFile, ProviderOptions };

export const useWizardStore = defineStore('wizard', {
  state: (): WizardState => ({
    sessionId: null,
    currentStep: 1,

    uploadedFiles: [],

    providers: {},
    selectedProvider: 'ollama',
    selectedModel: 'llama3.1:8b',
    apiKeys: {},
    providerOptions: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0
    },

    promptText: '',
    selectedTemplate: null,

    processingMode: 'standard',
    outputFormat: 'rich_text',
    additionalSettings: {
      includeSourceReferences: true,
      generateVisualizations: false,
      enableFollowUpQuestions: false
    },

    result: null,

    isLoading: false,
    error: null
  }),

  getters: {
    totalFileSize: (state) => {
      return state.uploadedFiles.reduce((sum, file) => sum + file.size, 0);
    },

    totalTokenCount: (state) => {
      return state.uploadedFiles.reduce((sum, file) => sum + (file.tokenCount || 0), 0);
    },

    canProceedToNextStep: (state) => {
      switch (state.currentStep) {
        case 1:
          return state.uploadedFiles.length > 0;
        case 2:
          return state.selectedProvider && state.selectedModel;
        case 3:
          return state.promptText.trim().length > 0;
        case 4:
          return true;
        default:
          return false;
      }
    },

    selectedProviderData: (state) => {
      return state.providers[state.selectedProvider] || null;
    },

    selectedModelData: (state) => {
      const provider = state.providers[state.selectedProvider];
      if (!provider) return null;
      return provider.models.find(m => m.id === state.selectedModel) || null;
    }
  },

  actions: {
    async fetchAvailableModels() {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await api.get('/models');
        if (response.data.success) {
          this.providers = response.data.data.providers;
          this.selectedProvider = response.data.data.default || 'ollama';
          this.selectedModel = response.data.data.defaultModel || 'llama3.1:8b';
        }
      } catch (error: unknown) {
        const err = error as ApiError;
        this.error = err.response?.data?.error || err.message || 'Failed to fetch models';
        console.error('Failed to fetch models:', error);
        // Load mock data for development
        this.loadMockProviders();
      } finally {
        this.isLoading = false;
      }
    },

    loadMockProviders() {
      this.providers = {
        ollama: {
          type: 'local',
          available: true,
          models: [
            { id: 'llama3.1:8b', name: 'Llama 3.1 8B', contextWindow: 8192, recommended: true },
            { id: 'llama3.1:70b', name: 'Llama 3.1 70B', contextWindow: 8192 },
            { id: 'mistral:latest', name: 'Mistral', contextWindow: 8192 }
          ],
          baseUrl: 'http://localhost:11434'
        },
        openai: {
          type: 'api',
          available: true,
          requiresApiKey: true,
          models: [
            { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', contextWindow: 128000, costPer1kTokens: 0.01 },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385, costPer1kTokens: 0.0005 }
          ]
        },
        anthropic: {
          type: 'api',
          available: true,
          requiresApiKey: true,
          models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, costPer1kTokens: 0.003, recommended: true }
          ]
        },
        gemini: {
          type: 'api',
          available: false,
          requiresApiKey: true,
          models: [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, costPer1kTokens: 0.00125 }
          ]
        }
      };
      this.selectedProvider = 'ollama';
      this.selectedModel = 'llama3.1:8b';
    },

    async configureModel() {
      if (!this.sessionId) {
        this.error = 'No session available';
        return false;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await api.post('/models/configure', {
          sessionId: this.sessionId,
          provider: this.selectedProvider,
          model: this.selectedModel,
          apiKey: this.apiKeys[this.selectedProvider] || undefined,
          options: this.providerOptions
        });

        return response.data.success;
      } catch (error: unknown) {
        const err = error as ApiError;
        this.error = err.response?.data?.error || err.message || 'Failed to configure model';
        console.error('Failed to configure model:', error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async startProcessing() {
      if (!this.sessionId) {
        this.error = 'No session available';
        return false;
      }

      this.isLoading = true;
      this.error = null;

      try {
        // First configure the model
        await this.configureModel();

        // Then submit prompts
        const response = await api.post('/prompts', {
          sessionId: this.sessionId,
          prompts: [
            {
              content: this.promptText,
              priority: 1,
              targetType: 'GLOBAL'
            }
          ]
        });

        if (response.data.success) {
          // Start polling for status or redirect to results
          return true;
        }
        return false;
      } catch (error: unknown) {
        const err = error as ApiError;
        this.error = err.response?.data?.error || err.message || 'Failed to start processing';
        console.error('Failed to start processing:', error);
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async uploadFiles(files: File[]) {
      this.isLoading = true;
      this.error = null;

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      try {
        const response = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (response.data.success) {
          this.sessionId = response.data.data.sessionId;
          this.uploadedFiles = response.data.data.files;
        }
      } catch (error: unknown) {
        const err = error as ApiError;
        this.error = err.response?.data?.error || err.message || 'Failed to upload files';
        console.error('Failed to upload files:', error);
      } finally {
        this.isLoading = false;
      }
    },

    removeFile(fileId: string) {
      this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== fileId);
    },

    setProvider(providerId: string) {
      this.selectedProvider = providerId;
      const provider = this.providers[providerId];
      if (provider && provider.models.length > 0) {
        const recommended = provider.models.find(m => m.recommended);
        this.selectedModel = recommended ? recommended.id : provider.models[0].id;
      }
    },

    setModel(modelId: string) {
      this.selectedModel = modelId;
    },

    setApiKey(provider: string, apiKey: string) {
      this.apiKeys[provider] = apiKey;
    },

    setTemplate(templateId: string) {
      this.selectedTemplate = templateId;

      // Preset prompts based on template
      const templates: Record<string, string> = {
        'summarize': 'Summarize the main points of this document, highlighting key findings and conclusions.',
        'extract': 'Extract all structured data from this document into organized tables.',
        'format': 'Improve the document formatting and organization for better readability.',
        'questions': 'Generate follow-up questions based on the content of this document.'
      };

      if (templates[templateId]) {
        this.promptText = templates[templateId];
      }
    },

    nextStep() {
      if (this.currentStep < 5 && this.canProceedToNextStep) {
        this.currentStep++;
      }
    },

    previousStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
      }
    },

    goToStep(step: number) {
      if (step >= 1 && step <= 5) {
        this.currentStep = step;
      }
    },

    resetWizard() {
      this.$reset();
    },

    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getFileIcon(mimeType: string): string {
      if (mimeType.includes('pdf')) return 'picture_as_pdf';
      if (mimeType.includes('word') || mimeType.includes('docx')) return 'description';
      if (mimeType.includes('excel') || mimeType.includes('xlsx')) return 'table_chart';
      if (mimeType.includes('csv')) return 'grid_on';
      return 'insert_drive_file';
    }
  }
});
