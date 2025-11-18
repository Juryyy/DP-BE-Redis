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
  ProcessingResult,
  MultiModelResponse
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
  selectedModels: Array<{ provider: string; modelId: string }>; // Support multi-provider selection
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
  result: MultiModelResponse | null;

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
    selectedModel: '',
    selectedModels: [],
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
          return state.selectedModels.length > 0;
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
        const response = await api.get('/api/admin/models/providers');
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
      // Only show providers with API keys configured or mark as unavailable
      this.providers = {
        ollama: {
          id: 'ollama',
          name: 'Ollama (Local)',
          description: 'Run AI models locally on your machine',
          type: 'local',
          available: false,
          requiresApiKey: false,
          models: [],
          baseUrl: 'http://localhost:11434'
        },
        openai: {
          id: 'openai',
          name: 'OpenAI',
          description: 'Access GPT models from OpenAI',
          type: 'api',
          available: false,
          requiresApiKey: true,
          models: [
            { id: 'gpt-4o', name: 'GPT-4 Omni', contextWindow: 128000, costPer1kTokens: 0.005, recommended: true },
            { id: 'gpt-4o-mini', name: 'GPT-4 Omni Mini', contextWindow: 128000, costPer1kTokens: 0.00015 }
          ]
        },
        anthropic: {
          id: 'anthropic',
          name: 'Anthropic',
          description: 'Access Claude models from Anthropic',
          type: 'api',
          available: false,
          requiresApiKey: true,
          models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', contextWindow: 200000, costPer1kTokens: 0.003, recommended: true },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextWindow: 200000, costPer1kTokens: 0.00025 }
          ]
        },
        gemini: {
          id: 'gemini',
          name: 'Google Gemini',
          description: 'Access Gemini models from Google',
          type: 'api',
          available: false,
          requiresApiKey: true,
          models: [
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 1000000, costPer1kTokens: 0.00125, recommended: true },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, costPer1kTokens: 0.000075 }
          ]
        }
      };

      // Try to find first available provider
      const firstAvailable = Object.entries(this.providers).find(([_, p]) => p.available);
      if (firstAvailable) {
        this.selectedProvider = firstAvailable[0];
        if (firstAvailable[1].models.length > 0) {
          const recommended = firstAvailable[1].models.find(m => m.recommended);
          const firstModel = recommended?.id || firstAvailable[1].models[0].id;
          this.selectedModel = firstModel;
          this.selectedModels = [firstModel];
        }
      }
    },

    async configureModel() {
      if (!this.sessionId) {
        this.error = 'No session available';
        return false;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await api.post('/api/wizard/configure-model', {
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
        // Build model configurations for multi-model, multi-provider execution
        const models = this.selectedModels.map(({ provider, modelId }) => {
          const providerData = this.providers[provider];
          const model = providerData?.models.find(m => m.id === modelId);
          return {
            provider: provider,
            modelName: modelId,
            temperature: this.providerOptions.temperature,
            maxTokens: this.providerOptions.maxTokens,
            topP: this.providerOptions.topP,
            apiKey: this.apiKeys[provider]
          };
        });

        // Execute with multi-model API
        const response = await api.post('/api/wizard/multi-model/execute', {
          prompt: this.promptText,
          models,
          sessionId: this.sessionId
        });

        if (response.data.success) {
          this.result = response.data.data;
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
        const response = await api.post('/api/wizard/upload', formData, {
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

    setUploadedFiles(files: UploadedFile[]) {
      this.uploadedFiles = files;
    },

    setSessionId(sessionId: string) {
      this.sessionId = sessionId;
    },

    setProvider(providerId: string) {
      this.selectedProvider = providerId;
      // Don't clear selected models - allow multi-provider selection
    },

    setModel(modelId: string) {
      this.selectedModel = modelId;
      // For backwards compatibility, update selected models
      const existing = this.selectedModels.find(m => m.provider === this.selectedProvider);
      if (existing) {
        existing.modelId = modelId;
      } else {
        this.selectedModels = [{ provider: this.selectedProvider, modelId }];
      }
    },

    toggleModel(provider: string, modelId: string) {
      const index = this.selectedModels.findIndex(
        m => m.provider === provider && m.modelId === modelId
      );

      if (index > -1) {
        // Remove model if already selected
        this.selectedModels.splice(index, 1);
      } else {
        // Add model to selection
        this.selectedModels.push({ provider, modelId });
      }

      // Update primary selected model if needed
      if (this.selectedModels.length > 0 && this.selectedProvider === provider) {
        this.selectedModel = this.selectedModels.find(m => m.provider === provider)?.modelId || '';
      }
    },

    isModelSelected(provider: string, modelId: string): boolean {
      return this.selectedModels.some(m => m.provider === provider && m.modelId === modelId);
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
