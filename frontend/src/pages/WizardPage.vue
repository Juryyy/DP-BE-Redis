<template>
  <q-page class="q-pa-md">
    <div class="wizard-container">
      <div class="text-h4 text-center q-mb-lg">AI Document Processing Wizard</div>

      <WizardStepper
        :current-step="wizardStore.currentStep"
        :can-continue="wizardStore.canProceedToNextStep"
        :is-processing="wizardStore.isLoading"
        @back="wizardStore.previousStep"
        @next="wizardStore.nextStep"
        @process="handleStartProcessing"
        @update:current-step="(step) => wizardStore.currentStep = step"
      >
        <template #step1>
          <FileUploader
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
          <PromptInput
            v-model="wizardStore.promptText"
            :selected-template="wizardStore.selectedTemplate"
            :files="wizardStore.uploadedFiles"
            @update:selected-template="(val) => wizardStore.selectedTemplate = val"
          />
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
    </div>

    <!-- Error Dialog -->
    <q-dialog v-model="showError">
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="error" color="negative" text-color="white" />
          <span class="q-ml-sm text-h6">Error</span>
        </q-card-section>
        <q-card-section>
          {{ wizardStore.error }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="OK" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Results Dialog -->
    <q-dialog v-model="showResults" full-width full-height>
      <q-card>
        <q-card-section class="row items-center bg-primary text-white">
          <q-icon name="check_circle" size="md" class="q-mr-md" />
          <div class="text-h6">Processing Results</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="wizardStore.result" class="q-pa-md">
          <div v-if="wizardStore.result.results && wizardStore.result.results.length > 0">
            <div v-for="(modelResult, idx) in wizardStore.result.results" :key="idx" class="q-mb-lg">
              <q-card bordered>
                <q-card-section class="bg-grey-1">
                  <div class="row items-center">
                    <q-icon :name="getProviderIcon(modelResult.provider)" size="sm" class="q-mr-sm" />
                    <div class="text-subtitle1 text-weight-medium">
                      {{ getProviderLabel(modelResult.provider) }}: {{ modelResult.modelName }}
                    </div>
                    <q-space />
                    <q-badge
                      :color="modelResult.success ? 'positive' : 'negative'"
                      :label="modelResult.success ? 'Success' : 'Failed'"
                    />
                  </div>
                </q-card-section>

                <q-card-section v-if="modelResult.success">
                  <div class="text-body1" style="white-space: pre-wrap">{{ modelResult.response }}</div>
                  <q-separator class="q-my-md" />
                  <div class="text-caption text-grey">
                    <q-icon name="schedule" size="xs" class="q-mr-xs" />
                    Completed in {{ modelResult.duration }}ms
                  </div>
                </q-card-section>

                <q-card-section v-else>
                  <q-banner class="bg-negative text-white">
                    <template #avatar>
                      <q-icon name="error" />
                    </template>
                    {{ modelResult.error || 'Unknown error occurred' }}
                  </q-banner>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <q-banner v-else class="bg-warning">
            <template #avatar>
              <q-icon name="warning" />
            </template>
            No results available
          </q-banner>

          <!-- Summary -->
          <q-card bordered class="q-mt-md" v-if="wizardStore.result.summary">
            <q-card-section class="bg-info text-white">
              <div class="text-subtitle1">Summary</div>
            </q-card-section>
            <q-card-section>
              <div class="row q-col-gutter-md">
                <div class="col-6 col-md-3">
                  <div class="text-caption text-grey">Total Duration</div>
                  <div class="text-h6">{{ wizardStore.result.summary.totalDuration }}ms</div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="text-caption text-grey">Successful</div>
                  <div class="text-h6 text-positive">{{ wizardStore.result.summary.successCount }}</div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="text-caption text-grey">Failed</div>
                  <div class="text-h6 text-negative">{{ wizardStore.result.summary.failureCount }}</div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="text-caption text-grey">Total Models</div>
                  <div class="text-h6">{{ wizardStore.result.summary.totalModels }}</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn label="Close" color="primary" v-close-popup />
          <q-btn label="Start New" color="secondary" @click="resetWizard" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useWizardStore } from 'stores/wizard-store';
import WizardStepper from 'components/wizard/WizardStepper.vue';
import FileUploader from 'components/wizard/FileUploader.vue';
import ModelSelector from 'components/wizard/ModelSelector.vue';
import PromptInput from 'components/wizard/PromptInput.vue';
import ProcessingOptions from 'components/wizard/ProcessingOptions.vue';
import type { FileUploadEvent } from 'src/types/file.types';
import type { ProviderOptions } from 'src/types/ai.types';
import type { AdditionalSettings } from 'src/types/wizard.types';

const $q = useQuasar();
const wizardStore = useWizardStore();

const showError = computed({
  get: () => !!wizardStore.error,
  set: () => { wizardStore.error = null; }
});

const showResults = computed({
  get: () => !!wizardStore.result,
  set: () => { wizardStore.result = null; }
});

const processingSummary = computed(() => ({
  files: wizardStore.uploadedFiles.map(f => f.filename).join(', ') || 'No files',
  task: wizardStore.promptText || 'No task specified',
  mode: formatProcessingMode(wizardStore.processingMode),
  format: formatOutputFormat(wizardStore.outputFormat),
  model: wizardStore.selectedModelData?.name || wizardStore.selectedModel
}));

onMounted(async () => {
  await wizardStore.fetchAvailableModels();
});

watch(() => wizardStore.error, (newError) => {
  if (newError) {
    $q.notify({
      type: 'negative',
      message: newError,
      position: 'top'
    });
  }
});

function handleUploadSuccess(data: FileUploadEvent) {
  wizardStore.sessionId = data.sessionId;
  wizardStore.uploadedFiles = data.files;
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
  const success = await wizardStore.startProcessing();
  if (success) {
    $q.notify({
      type: 'positive',
      message: 'Processing started successfully!',
      position: 'top'
    });
    // TODO: Redirect to results page or show processing status
  }
}

function formatProcessingMode(mode: string): string {
  const modes: Record<string, string> = {
    standard: 'Standard',
    high_precision: 'High Precision',
    quick_draft: 'Quick Draft'
  };
  return modes[mode] || mode;
}

function formatOutputFormat(format: string): string {
  const formats: Record<string, string> = {
    rich_text: 'Rich Text',
    pdf: 'PDF Document',
    plain_text: 'Plain Text'
  };
  return formats[format] || format;
}

function getProviderIcon(provider: string): string {
  if (provider === 'ollama' || provider === 'ollamaRemote') return 'computer';
  if (provider === 'openai') return 'psychology';
  if (provider === 'anthropic') return 'smart_toy';
  if (provider === 'gemini') return 'stars';
  return 'api';
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    ollama: 'Ollama (Local)',
    ollamaRemote: 'Ollama (Remote)',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  };
  return labels[provider] || provider;
}

function resetWizard() {
  wizardStore.resetWizard();
  showResults.value = false;
}
</script>

<style scoped>
.wizard-container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
