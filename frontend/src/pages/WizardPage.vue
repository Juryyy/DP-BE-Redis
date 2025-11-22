<template>
  <q-page class="wizard-page">
    <!-- Animated gradient background -->
    <div class="gradient-background"></div>

    <div class="wizard-container">
      <!-- Header -->
      <div class="wizard-header">
        <h4 class="header-title">AI Document Processing</h4>
      </div>

      <!-- Main wizard card -->
      <q-card class="wizard-card">
        <WizardStepper
          :current-step="wizardStore.currentStep"
          :can-continue="canContinue"
          :is-processing="wizardStore.isLoading"
          @back="wizardStore.previousStep"
          @next="handleNext"
          @process="handleStartProcessing"
          @update:current-step="(step) => wizardStore.currentStep = step"
        >
          <template #step1>
            <FileUploader
              ref="fileUploaderRef"
              :uploaded-files="wizardStore.uploadedFiles"
              :session-id="wizardStore.sessionId"
              @upload-success="handleUploadSuccess"
              @upload-failed="handleUploadFailed"
              @remove-file="wizardStore.removeFile"
            />
          </template>

          <template #step2>
            <ModelSelector
              :providers="wizardStore.providers"
              :selected-models="wizardStore.selectedModels"
              :api-keys="wizardStore.apiKeys"
              :options="wizardStore.providerOptions"
              @toggle-model="wizardStore.toggleModel"
              @update:api-key="wizardStore.setApiKey"
              @update:options="handleOptionsUpdate"
              @refresh="wizardStore.fetchAvailableModels"
            />
          </template>

          <template #step3>
            <PromptBuilder />
          </template>

          <template #step4>
            <ProcessingOptions
              :processing-mode="wizardStore.processingMode"
              :output-format="wizardStore.outputFormat"
              :additional-settings="wizardStore.additionalSettings"
              :summary="processingSummary"
              @update:processing-mode="(val) => wizardStore.processingMode = val"
              @update:output-format="(val) => wizardStore.outputFormat = val"
              @update:additional-settings="handleSettingsUpdate"
            />
          </template>
        </WizardStepper>
      </q-card>
    </div>

    <!-- Modern Error Dialog -->
    <q-dialog v-model="showError" class="modern-dialog">
      <q-card class="error-card">
        <q-card-section class="error-header">
          <div class="error-icon-wrapper">
            <q-icon name="error_outline" size="48px" />
          </div>
          <div class="text-h6 q-mt-md">Oops! Something went wrong</div>
        </q-card-section>
        <q-card-section class="error-content">
          {{ wizardStore.error }}
        </q-card-section>
        <q-card-actions align="center" class="q-pb-md">
          <q-btn
            unelevated
            label="Got it"
            color="negative"
            class="action-button"
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Modern Results Dialog -->
    <q-dialog v-model="showResults" maximized transition-show="slide-up" transition-hide="slide-down">
      <q-card class="results-card">
        <!-- Header with gradient -->
        <q-card-section class="results-header">
          <div class="results-header-content">
            <q-icon name="celebration" size="56px" class="results-icon" />
            <h2 class="results-title">Processing Complete!</h2>
            <p class="results-subtitle">{{ wizardStore.result?.results.length || 0 }} model(s) processed your request</p>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            class="close-btn"
            size="lg"
            v-close-popup
          />
        </q-card-section>

        <q-card-section class="results-content" v-if="wizardStore.result">
          <!-- Summary Cards -->
          <div class="summary-grid">
            <div class="summary-card">
              <q-icon name="timer" size="32px" class="summary-icon timer" />
              <div class="summary-value">{{ formatDuration(wizardStore.result.totalDuration) }}</div>
              <div class="summary-label">Total Duration</div>
            </div>
            <div class="summary-card">
              <q-icon name="check_circle" size="32px" class="summary-icon success" />
              <div class="summary-value">{{ wizardStore.result.successCount }}</div>
              <div class="summary-label">Successful</div>
            </div>
            <div class="summary-card">
              <q-icon name="cancel" size="32px" class="summary-icon error" />
              <div class="summary-value">{{ wizardStore.result.failureCount }}</div>
              <div class="summary-label">Failed</div>
            </div>
            <div class="summary-card">
              <q-icon name="analytics" size="32px" class="summary-icon total" />
              <div class="summary-value">{{ wizardStore.result.results.length }}</div>
              <div class="summary-label">Total Models</div>
            </div>
          </div>

          <!-- Model Results -->
          <div v-if="wizardStore.result.results && wizardStore.result.results.length > 0" class="results-list">
            <div v-for="(modelResult, idx) in wizardStore.result.results" :key="idx" class="result-item">
              <q-card flat bordered class="model-result-card">
                <div class="model-result-header" :class="modelResult.status === 'completed' ? 'success-gradient' : 'error-gradient'">
                  <div class="model-info">
                    <q-avatar size="42px" :color="getProviderColor(modelResult.provider)">
                      <q-icon :name="getProviderIcon(modelResult.provider)" color="white" />
                    </q-avatar>
                    <div class="model-details">
                      <div class="model-name">{{ modelResult.modelName }}</div>
                      <div class="provider-name">{{ getProviderLabel(modelResult.provider) }}</div>
                    </div>
                  </div>
                  <q-chip
                    :color="modelResult.status === 'completed' ? 'positive' : 'negative'"
                    text-color="white"
                    :icon="modelResult.status === 'completed' ? 'check_circle' : 'error'"
                    class="status-chip"
                  >
                    {{ modelResult.status === 'completed' ? 'Success' : 'Failed' }}
                  </q-chip>
                </div>

                <q-card-section v-if="modelResult.status === 'completed'" class="result-content">
                  <div class="result-text">{{ modelResult.result }}</div>
                  <div class="result-meta">
                    <q-chip outline color="primary" icon="schedule" size="sm">
                      {{ modelResult.duration }}ms
                    </q-chip>
                    <q-chip v-if="modelResult.tokensUsed" outline color="secondary" icon="data_usage" size="sm">
                      {{ modelResult.tokensUsed }} tokens
                    </q-chip>
                  </div>
                </q-card-section>

                <q-card-section v-else class="error-content">
                  <div class="error-message">
                    <q-icon name="warning" size="24px" class="q-mr-sm" />
                    {{ modelResult.error || 'Unknown error occurred' }}
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <q-banner v-else rounded class="no-results-banner">
            <template #avatar>
              <q-icon name="info" color="info" size="md" />
            </template>
            <div class="text-body1">No results available</div>
          </q-banner>
        </q-card-section>

        <q-card-actions align="center" class="results-actions">
          <q-btn
            unelevated
            label="Start New Process"
            color="primary"
            icon="refresh"
            size="lg"
            class="action-button"
            @click="wizardStore.resetWizard(); showResults = false"
          />
          <q-btn
            outline
            label="Close"
            color="primary"
            size="lg"
            class="action-button"
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWizardStore } from 'stores/wizard-store';
import WizardStepper from 'components/wizard/WizardStepper.vue';
import FileUploader from 'components/wizard/FileUploader.vue';
import ModelSelector from 'components/wizard/ModelSelector.vue';
import PromptBuilder from 'components/wizard/PromptBuilder.vue';
import ProcessingOptions from 'components/wizard/ProcessingOptions.vue';
import type { ProviderOptions, AdditionalSettings } from 'src/types/ai.types';
import type { FileUploadEvent } from 'src/types/file.types';

const router = useRouter();
const wizardStore = useWizardStore();
const fileUploaderRef = ref<InstanceType<typeof FileUploader> | null>(null);

const showError = computed({
  get: () => !!wizardStore.error,
  set: () => { wizardStore.error = null; }
});

const showResults = computed({
  get: () => !!wizardStore.result,
  set: () => { wizardStore.result = null; }
});

const canContinue = computed(() => {
  if (wizardStore.currentStep === 1) {
    // On step 1, check if files are selected
    return fileUploaderRef.value?.hasFiles || false;
  }
  return wizardStore.canProceedToNextStep;
});

const processingSummary = computed(() => ({
  files: `${wizardStore.uploadedFiles.length} file(s)`,
  task: wizardStore.prompts.length
    ? `${wizardStore.prompts.length} prompt(s) configured`
    : 'No prompts yet',
  mode: wizardStore.processingMode,
  format: wizardStore.outputFormat,
  model: wizardStore.selectedModels.length > 0
    ? `${wizardStore.selectedModels.length} model(s)`
    : 'Not selected'
}));

async function handleNext() {
  // If we're on step 1, upload files before moving forward
  if (wizardStore.currentStep === 1 && fileUploaderRef.value) {
    if (fileUploaderRef.value.hasFiles) {
      // Upload files
      await fileUploaderRef.value.uploadFiles();
      // Wait a bit for the upload success handler to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only proceed if we have a session ID (upload was successful)
      if (wizardStore.sessionId) {
        wizardStore.nextStep();
      }
    }
  } else {
    // For other steps, just go to next
    wizardStore.nextStep();
  }
}

function handleUploadSuccess(event: FileUploadEvent) {
  console.log('WizardPage handleUploadSuccess called with:', event);
  wizardStore.setSessionId(event.sessionId);
  wizardStore.setUploadedFiles(event.files);
  console.log('Store uploadedFiles after setting:', wizardStore.uploadedFiles);
}

function handleUploadFailed(error: string) {
  wizardStore.error = error;
}

function handleOptionsUpdate(options: ProviderOptions) {
  wizardStore.providerOptions = options;
}

function handleSettingsUpdate(settings: AdditionalSettings) {
  wizardStore.additionalSettings = settings;
}

async function handleStartProcessing() {
  // Get prompts from store
  const prompts = wizardStore.prompts;

  // Validate prompts
  if (!prompts || prompts.length === 0) {
    wizardStore.error = 'Please add at least one prompt before processing';
    return;
  }

  // Validate prompt contents
  const hasInvalidPrompt = prompts.some((p) => {
    const hasContent = !!p.content;
    const hasPriority = typeof p.priority === 'number' && p.priority >= 0;
    const hasTargetFile =
      p.targetType !== 'FILE_SPECIFIC' && p.targetType !== 'LINE_SPECIFIC'
        ? true
        : !!p.targetFileId;
    const hasTargetSection = p.targetType !== 'SECTION_SPECIFIC' ? true : !!p.targetSection;
    const hasValidLines =
      p.targetType !== 'LINE_SPECIFIC' ? true :
      !!(p.targetLines && p.targetLines.start >= 1 && p.targetLines.end >= p.targetLines.start);

    return !(hasContent && hasPriority && hasTargetFile && hasTargetSection && hasValidLines);
  });

  if (hasInvalidPrompt) {
    wizardStore.error = 'Please ensure all prompts are properly configured';
    return;
  }

  // Start processing with prompts (don't wait for completion)
  wizardStore.startProcessing(prompts);

  // Navigate to processing page
  router.push('/processing');
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    ollama: 'computer',
    openai: 'psychology',
    anthropic: 'auto_awesome',
    gemini: 'stars'
  };
  return icons[provider] || 'cloud';
}

function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    ollama: 'blue-7',
    openai: 'green-7',
    anthropic: 'purple-7',
    gemini: 'orange-7'
  };
  return colors[provider] || 'grey-7';
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  };
  return labels[provider] || provider;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Load models on mount
onMounted(() => {
  wizardStore.fetchAvailableModels();
});
</script>

<style scoped lang="scss">
.wizard-page {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.gradient-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f9fafb 100%);
  z-index: 0;
}

.wizard-container {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.wizard-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.header-title {
  color: #374151;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.wizard-card {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
}

/* Error Dialog Styles */
.error-card {
  min-width: 400px;
  border-radius: 16px;
  overflow: hidden;
}

.error-header {
  background: #dc2626;
  color: white;
  text-align: center;
  padding: 2rem;
}

.error-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.error-content {
  padding: 2rem;
  text-align: center;
  font-size: 1.1rem;
  color: #555;
}

/* Results Dialog Styles */
.results-card {
  background: #f8f9fa;
  max-height: 100vh;
  overflow-y: auto;
}

.results-header {
  background: #1e40af;
  color: white;
  padding: 2.5rem 2rem;
  position: relative;
  text-align: center;
}

.results-header-content {
  max-width: 600px;
  margin: 0 auto;
}

.results-icon {
  animation: bounceIn 0.8s ease;
}

@keyframes bounceIn {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.results-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 1rem 0 0.5rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.results-subtitle {
  font-size: 1.2rem;
  opacity: 0.95;
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: white;
}

.results-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.summary-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.summary-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.summary-icon {
  margin-bottom: 0.75rem;
}

.summary-icon.timer { color: #3b82f6; }
.summary-icon.success { color: #059669; }
.summary-icon.error { color: #dc2626; }
.summary-icon.total { color: #6366f1; }

.summary-value {
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 0.25rem;
}

.summary-label {
  font-size: 0.9rem;
  color: #7f8c8d;
  font-weight: 500;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-item {
  animation: slideInLeft 0.5s ease;
  animation-fill-mode: both;
}

.result-item:nth-child(1) { animation-delay: 0.1s; }
.result-item:nth-child(2) { animation-delay: 0.2s; }
.result-item:nth-child(3) { animation-delay: 0.3s; }
.result-item:nth-child(4) { animation-delay: 0.4s; }

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.model-result-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 2px solid #e9ecef;
}

.model-result-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.model-result-header {
  padding: 1.25rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.success-gradient {
  background: #d1fae5;
}

.error-gradient {
  background: #fee2e2;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.model-details {
  display: flex;
  flex-direction: column;
}

.model-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
}

.provider-name {
  font-size: 0.85rem;
  color: #7f8c8d;
  font-weight: 500;
}

.status-chip {
  font-weight: 600;
}

.result-content {
  padding: 1.5rem;
  background: white;
}

.result-text {
  white-space: pre-wrap;
  font-size: 1rem;
  line-height: 1.6;
  color: #374151;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.result-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.error-content {
  padding: 1.5rem;
  background: white;
}

.error-message {
  display: flex;
  align-items: center;
  color: #e74c3c;
  font-weight: 500;
  padding: 1rem;
  background: #fff5f5;
  border-radius: 8px;
  border-left: 4px solid #e74c3c;
}

.no-results-banner {
  background: white;
  border: 2px solid #e9ecef;
}

.results-actions {
  padding: 2rem;
  background: white;
  border-top: 1px solid #e9ecef;
  gap: 1rem;
}

.action-button {
  min-width: 180px;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  text-transform: none;
  font-size: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .wizard-container {
    padding: 1rem 0.75rem;
  }

  .header-title {
    font-size: 1.25rem;
  }

  .results-title {
    font-size: 1.5rem;
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
