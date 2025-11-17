<template>
  <q-page class="wizard-container">
    <!-- Wizard Header -->
    <div class="text-h4 text-center q-mb-lg">AI Document Processing Wizard</div>

    <!-- Step Indicator -->
    <div class="step-indicator">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex items-center"
      >
        <div
          :class="[
            'step-circle',
            {
              active: wizardStore.currentStep === index + 1,
              completed: wizardStore.currentStep > index + 1,
              pending: wizardStore.currentStep < index + 1
            }
          ]"
        >
          <q-icon
            v-if="wizardStore.currentStep > index + 1"
            name="check"
            size="sm"
          />
          <q-icon
            v-else
            :name="step.icon"
            size="sm"
          />
        </div>
        <div class="q-ml-sm q-mr-md text-caption">{{ step.label }}</div>
        <q-icon
          v-if="index < steps.length - 1"
          name="arrow_forward"
          class="step-arrow"
        />
      </div>
    </div>

    <!-- Wizard Content -->
    <q-card class="wizard-card q-pa-lg">
      <!-- Step 1: Upload Files -->
      <div v-if="wizardStore.currentStep === 1">
        <div class="text-h5 q-mb-md">Step 1: Upload Files</div>

        <div
          class="upload-zone"
          :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <q-icon name="cloud_upload" size="64px" color="grey-6" />
          <div class="text-h6 q-mt-md">Drag and drop your files here</div>
          <div class="text-caption text-grey">or</div>
          <q-btn
            color="primary"
            label="Browse Files"
            class="q-mt-sm"
            @click.stop="triggerFileInput"
          />
          <div class="text-caption text-grey q-mt-sm">
            Supports PDF, DOCX, TXT, CSV (Max 25MB)
          </div>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
            style="display: none"
            @change="handleFileSelect"
          />
        </div>

        <!-- File List -->
        <div v-if="wizardStore.uploadedFiles.length > 0" class="file-list">
          <div class="text-subtitle1 q-mb-sm">
            Selected Files ({{ wizardStore.uploadedFiles.length }})
          </div>
          <div
            v-for="file in wizardStore.uploadedFiles"
            :key="file.id"
            class="file-item"
          >
            <q-icon
              :name="wizardStore.getFileIcon(file.mimeType)"
              :color="getFileColor(file.mimeType)"
              class="file-icon"
            />
            <div class="file-info">
              <div class="file-name">{{ file.filename }}</div>
              <div class="file-size">
                {{ wizardStore.formatFileSize(file.size) }} -
                {{ file.mimeType.split('/')[1].toUpperCase() }}
              </div>
            </div>
            <q-btn
              flat
              round
              icon="delete"
              color="negative"
              size="sm"
              @click="wizardStore.removeFile(file.id)"
            />
          </div>
        </div>
      </div>

      <!-- Step 2: Select AI Model -->
      <div v-if="wizardStore.currentStep === 2">
        <div class="text-h5 q-mb-md">Step 2: Select AI Model</div>
        <div class="text-body2 q-mb-lg text-grey-7">
          Choose the AI provider and model for processing your documents.
        </div>

        <!-- Provider Selection -->
        <div class="text-subtitle1 q-mb-sm">AI Provider</div>
        <div class="row q-col-gutter-md q-mb-lg">
          <div
            v-for="(provider, key) in wizardStore.providers"
            :key="key"
            class="col-12 col-md-3"
          >
            <div
              class="model-card"
              :class="{
                selected: wizardStore.selectedProvider === key,
                'opacity-50': !provider.available
              }"
              @click="provider.available && wizardStore.setProvider(key)"
            >
              <div class="flex justify-between items-center q-mb-sm">
                <div class="text-subtitle1 text-weight-medium">
                  {{ formatProviderName(key) }}
                </div>
                <span :class="['provider-badge', provider.type]">
                  {{ provider.type.toUpperCase() }}
                </span>
              </div>
              <div class="text-caption text-grey">
                {{ provider.models.length }} model(s) available
              </div>
              <q-icon
                v-if="wizardStore.selectedProvider === key"
                name="check_circle"
                color="primary"
                class="absolute-top-right q-ma-sm"
              />
            </div>
          </div>
        </div>

        <!-- API Key Input (for API providers) -->
        <div
          v-if="wizardStore.selectedProviderData?.requiresApiKey"
          class="q-mb-lg"
        >
          <q-input
            v-model="wizardStore.apiKeys[wizardStore.selectedProvider]"
            :label="`${formatProviderName(wizardStore.selectedProvider)} API Key`"
            type="password"
            outlined
            dense
            hint="Your API key is stored locally and never shared"
          >
            <template #prepend>
              <q-icon name="vpn_key" />
            </template>
          </q-input>
        </div>

        <!-- Model Selection -->
        <div class="text-subtitle1 q-mb-sm">Select Model</div>
        <div class="row q-col-gutter-md">
          <div
            v-for="model in wizardStore.selectedProviderData?.models || []"
            :key="model.id"
            class="col-12 col-md-6"
          >
            <div
              class="model-card"
              :class="{ selected: wizardStore.selectedModel === model.id }"
              @click="wizardStore.setModel(model.id)"
            >
              <div class="flex justify-between items-center q-mb-sm">
                <div class="text-subtitle1 text-weight-medium">
                  {{ model.name }}
                </div>
                <q-badge
                  v-if="model.recommended"
                  color="positive"
                  label="Recommended"
                />
              </div>
              <div class="text-caption">
                <div>
                  <q-icon name="memory" size="xs" class="q-mr-xs" />
                  Context: {{ formatNumber(model.contextWindow) }} tokens
                </div>
                <div v-if="model.costPer1kTokens">
                  <q-icon name="attach_money" size="xs" class="q-mr-xs" />
                  Cost: ${{ model.costPer1kTokens }}/1K tokens
                </div>
              </div>
              <q-radio
                v-model="wizardStore.selectedModel"
                :val="model.id"
                class="absolute-top-right q-ma-xs"
              />
            </div>
          </div>
        </div>

        <!-- Advanced Options -->
        <q-expansion-item
          label="Advanced Options"
          icon="settings"
          class="q-mt-lg"
        >
          <q-card>
            <q-card-section>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                  <q-slider
                    v-model="wizardStore.providerOptions.temperature"
                    :min="0"
                    :max="2"
                    :step="0.1"
                    label
                    label-always
                    color="primary"
                  />
                  <div class="text-caption text-center">
                    Temperature: {{ wizardStore.providerOptions.temperature }}
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.number="wizardStore.providerOptions.maxTokens"
                    type="number"
                    label="Max Tokens"
                    outlined
                    dense
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-slider
                    v-model="wizardStore.providerOptions.topP"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    label
                    label-always
                    color="secondary"
                  />
                  <div class="text-caption text-center">
                    Top P: {{ wizardStore.providerOptions.topP }}
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </div>

      <!-- Step 3: Set AI Prompt -->
      <div v-if="wizardStore.currentStep === 3">
        <div class="text-h5 q-mb-md">Step 3: Set AI Prompt</div>
        <div class="text-body2 q-mb-lg text-grey-7">
          Tell the AI what you want to do with your document(s). Be as specific
          as possible for better results.
        </div>

        <!-- Quick Templates -->
        <div class="text-subtitle1 q-mb-sm">Quick Templates</div>
        <div class="row q-col-gutter-md q-mb-lg">
          <div class="col-12 col-md-3">
            <div
              class="template-card"
              @click="wizardStore.setTemplate('summarize')"
            >
              <div class="text-subtitle2">Summarize Document</div>
              <div class="text-caption text-grey">
                Create a concise summary highlighting key points
              </div>
            </div>
          </div>
          <div class="col-12 col-md-3">
            <div
              class="template-card"
              @click="wizardStore.setTemplate('extract')"
            >
              <div class="text-subtitle2">Extract Data</div>
              <div class="text-caption text-grey">
                Pull structured data from text into tables
              </div>
            </div>
          </div>
          <div class="col-12 col-md-3">
            <div
              class="template-card"
              @click="wizardStore.setTemplate('format')"
            >
              <div class="text-subtitle2">Format & Clean</div>
              <div class="text-caption text-grey">
                Improve document formatting and organization
              </div>
            </div>
          </div>
          <div class="col-12 col-md-3">
            <div
              class="template-card"
              @click="wizardStore.setTemplate('questions')"
            >
              <div class="text-subtitle2">Generate Questions</div>
              <div class="text-caption text-grey">
                Create follow-up questions based on content
              </div>
            </div>
          </div>
        </div>

        <!-- Prompt Input -->
        <div class="text-subtitle1 q-mb-sm">Your Instructions</div>
        <q-input
          v-model="wizardStore.promptText"
          type="textarea"
          outlined
          :rows="6"
          placeholder="Example: Summarize the main points of this report and extract all financial figures into a table."
        />

        <!-- Processing Files -->
        <div class="q-mt-lg">
          <div class="text-subtitle1 q-mb-sm">
            Processing Files ({{ wizardStore.uploadedFiles.length }})
          </div>
          <q-list dense>
            <q-item
              v-for="file in wizardStore.uploadedFiles"
              :key="file.id"
            >
              <q-item-section avatar>
                <q-icon
                  :name="wizardStore.getFileIcon(file.mimeType)"
                  :color="getFileColor(file.mimeType)"
                />
              </q-item-section>
              <q-item-section>{{ file.filename }}</q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>

      <!-- Step 4: Processing Options -->
      <div v-if="wizardStore.currentStep === 4">
        <div class="text-h5 q-mb-md">Step 4: Processing Options</div>
        <div class="text-body2 q-mb-lg text-grey-7">
          Configure how you want your document to be processed and what format
          you prefer for the output.
        </div>

        <div class="row q-col-gutter-lg">
          <!-- Processing Mode -->
          <div class="col-12 col-md-6">
            <div class="text-subtitle1 q-mb-sm">Processing Mode</div>
            <q-option-group
              v-model="wizardStore.processingMode"
              :options="processingModes"
              type="radio"
              class="q-gutter-sm"
            />
          </div>

          <!-- Output Format -->
          <div class="col-12 col-md-6">
            <div class="text-subtitle1 q-mb-sm">Output Format</div>
            <q-option-group
              v-model="wizardStore.outputFormat"
              :options="outputFormats"
              type="radio"
              class="q-gutter-sm"
            />
          </div>
        </div>

        <!-- Additional Settings -->
        <div class="q-mt-lg">
          <div class="text-subtitle1 q-mb-sm">Additional Settings</div>
          <q-checkbox
            v-model="wizardStore.additionalSettings.includeSourceReferences"
            label="Include source references"
          />
          <q-checkbox
            v-model="wizardStore.additionalSettings.generateVisualizations"
            label="Generate data visualizations"
          />
          <q-checkbox
            v-model="wizardStore.additionalSettings.enableFollowUpQuestions"
            label="Enable follow-up questions"
          />
        </div>

        <!-- Processing Summary -->
        <q-card class="q-mt-lg bg-grey-1">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">Processing Summary</div>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey">Files:</div>
                <div>
                  {{ wizardStore.uploadedFiles.map((f) => f.filename).join(', ') }}
                </div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey">Task:</div>
                <div class="text-truncate">{{ wizardStore.promptText }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey">Processing Mode:</div>
                <div>{{ formatProcessingMode(wizardStore.processingMode) }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey">Output Format:</div>
                <div>{{ formatOutputFormat(wizardStore.outputFormat) }}</div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey">AI Model:</div>
                <div>
                  {{ wizardStore.selectedModelData?.name || wizardStore.selectedModel }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Navigation Buttons -->
      <div class="flex justify-between q-mt-xl">
        <q-btn
          v-if="wizardStore.currentStep > 1"
          flat
          label="Back"
          icon="arrow_back"
          @click="wizardStore.previousStep"
        />
        <div v-else></div>

        <q-btn
          v-if="wizardStore.currentStep < 4"
          color="primary"
          label="Continue"
          icon-right="arrow_forward"
          :disable="!wizardStore.canProceedToNextStep"
          @click="wizardStore.nextStep"
        />
        <q-btn
          v-else
          color="positive"
          label="Start Processing"
          icon-right="play_arrow"
          :loading="wizardStore.isLoading"
          @click="startProcessing"
        />
      </div>
    </q-card>

    <!-- Loading Overlay -->
    <q-dialog v-model="wizardStore.isLoading" persistent>
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          <q-spinner-orbit size="50px" color="primary" />
          <div class="q-mt-md">Processing your request...</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWizardStore } from 'stores/wizard-store';

const wizardStore = useWizardStore();

const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const steps = [
  { id: 1, label: 'Upload Files', icon: 'cloud_upload' },
  { id: 2, label: 'Select AI Model', icon: 'psychology' },
  { id: 3, label: 'Set AI Prompt', icon: 'edit_note' },
  { id: 4, label: 'Processing Options', icon: 'settings' }
];

const processingModes = [
  {
    label: 'Standard Processing',
    value: 'standard',
    description: 'Balanced accuracy and speed (recommended)'
  },
  {
    label: 'High Precision',
    value: 'high_precision',
    description: 'More accurate but slower processing'
  },
  {
    label: 'Quick Draft',
    value: 'quick_draft',
    description: 'Faster processing with basic accuracy'
  }
];

const outputFormats = [
  {
    label: 'Rich Text',
    value: 'rich_text',
    description: 'Formatted text with tables and styling'
  },
  {
    label: 'PDF Document',
    value: 'pdf',
    description: 'Professional looking document format'
  },
  {
    label: 'Plain Text',
    value: 'plain_text',
    description: 'Simple text without formatting'
  }
];

onMounted(async () => {
  await wizardStore.fetchAvailableModels();
});

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const files = Array.from(target.files);
    wizardStore.uploadFiles(files);
  }
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false;
  if (event.dataTransfer?.files) {
    const files = Array.from(event.dataTransfer.files);
    wizardStore.uploadFiles(files);
  }
}

function getFileColor(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'red';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'blue';
  if (mimeType.includes('excel') || mimeType.includes('xlsx')) return 'green';
  if (mimeType.includes('csv')) return 'orange';
  return 'grey';
}

function formatProviderName(key: string): string {
  const names: Record<string, string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  };
  return names[key] || key;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
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

function startProcessing() {
  // TODO: Implement processing logic
  console.log('Starting processing...');
  console.log('Session ID:', wizardStore.sessionId);
  console.log('Provider:', wizardStore.selectedProvider);
  console.log('Model:', wizardStore.selectedModel);
  console.log('Prompt:', wizardStore.promptText);
}
</script>

<style scoped>
.model-card {
  position: relative;
}
</style>
