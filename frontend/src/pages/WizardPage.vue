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
            :selected-provider="wizardStore.selectedProvider"
            :selected-model="wizardStore.selectedModel"
            :api-keys="wizardStore.apiKeys"
            :options="wizardStore.providerOptions"
            @update:selected-provider="wizardStore.setProvider"
            @update:selected-model="wizardStore.setModel"
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

const $q = useQuasar();
const wizardStore = useWizardStore();

const showError = computed({
  get: () => !!wizardStore.error,
  set: () => { wizardStore.error = null; }
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

function handleUploadSuccess(data: { sessionId: string; files: { id: string; filename: string; size: number; mimeType: string; tokenCount?: number }[] }) {
  wizardStore.sessionId = data.sessionId;
  wizardStore.uploadedFiles = data.files;
}

function handleUploadFailed(error: string) {
  wizardStore.error = error;
}

function handleOptionsUpdate(options: { temperature: number; maxTokens: number; topP: number }) {
  wizardStore.providerOptions = options;
}

function handleSettingsUpdate(settings: { includeSourceReferences: boolean; generateVisualizations: boolean; enableFollowUpQuestions: boolean }) {
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
</script>

<style scoped>
.wizard-container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
