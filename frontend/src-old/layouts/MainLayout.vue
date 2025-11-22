<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center bg-grey-1">
        <div
          class="wizard-wrapper"
          :class="{ 'with-viewer': wizardStore.uploadedFiles.length > 0 && currentStep === 2 }"
        >
          <!-- Document Viewer Panel (left side) - Only on Step 2 -->
          <div
            v-if="wizardStore.uploadedFiles.length > 0 && currentStep === 2"
            class="document-viewer-panel"
          >
            <!-- Header with title and page navigation -->
            <div class="viewer-header">
              <div class="header-top">
                <q-icon name="description" size="xs" class="q-mr-xs" />
                <span class="header-title">Document Viewer</span>
              </div>

              <!-- File Tabs -->
              <div class="file-tabs">
                <div
                  v-for="(file, index) in wizardStore.uploadedFiles"
                  :key="file.id"
                  class="file-tab"
                  :class="{ active: selectedFileIndex === index }"
                  @click="selectedFileIndex = index"
                >
                  <q-icon name="description" size="xs" class="q-mr-xs" />
                  <span class="file-tab-label">{{ file.filename }}</span>
                </div>
              </div>

              <!-- Page Navigation (for PDFs) -->
              <div v-if="selectedFile && isPDF(selectedFile.filename)" class="page-navigation">
                <q-btn
                  flat
                  dense
                  round
                  icon="chevron_left"
                  size="xs"
                  @click="prevPage"
                  :disable="currentPage <= 1"
                  class="nav-btn"
                />
                <span class="page-indicator">{{ currentPage }} / {{ pdfNumPages }}</span>
                <q-btn
                  flat
                  dense
                  round
                  icon="chevron_right"
                  size="xs"
                  @click="nextPage"
                  :disable="currentPage >= pdfNumPages"
                  class="nav-btn"
                />
              </div>
            </div>

            <q-separator />

            <!-- Document Viewer -->
            <div class="viewer-content-wrapper">
              <DocumentViewer
                v-if="selectedFile && selectedLocalFile"
                :file="selectedLocalFile"
                :filename="selectedFile.filename"
                :mime-type="selectedFile.mimeType"
                :page="currentPage"
                :compact="true"
                @pdf-loaded="onPdfLoaded"
                @page-changed="onPageChanged"
              />
              <div v-else class="no-file-selected q-pa-xl text-center">
                <q-icon name="insert_drive_file" size="3rem" color="grey-5" class="q-mb-md" />
                <p class="text-grey-5">No file selected</p>
              </div>
            </div>
          </div>

          <!-- Main Wizard Container (right side) -->
          <div class="wizard-container">
            <!-- Header -->
            <div class="wizard-header q-pa-lg text-center">
              <h4 class="text-grey-8 q-ma-none q-mb-sm">AI Document Processing Wizard</h4>
              <p class="text-grey-6 q-ma-none">
                Transform your documents with AI-powered processing
              </p>
            </div>

            <!-- Progress Steps -->
            <div class="progress-container q-px-lg q-py-md">
              <q-stepper
                v-model="currentStep"
                color="primary"
                header-nav
                flat
                animated
                alternative-labels
              >
                <q-step
                  :name="1"
                  title="Upload Files"
                  icon="upload_file"
                  :done="currentStep > 1"
                  :header-nav="currentStep > 1"
                />
                <q-step
                  :name="2"
                  title="Set AI Prompt"
                  icon="chat"
                  :done="currentStep > 2"
                  :header-nav="currentStep > 2"
                />
                <q-step
                  :name="3"
                  title="Processing Options"
                  icon="settings"
                  :done="currentStep > 3"
                  :header-nav="currentStep > 3"
                />
                <q-step
                  :name="4"
                  title="Results"
                  icon="description"
                  :done="currentStep > 4"
                  :header-nav="currentStep > 4"
                />
              </q-stepper>
            </div>

            <!-- Step Content -->
            <div class="step-content">
              <!-- Step 1: Upload Files -->
              <div v-if="currentStep === 1" class="step-panel">
                <h5 class="q-mt-none q-mb-lg text-grey-8">Step 1: Upload Files</h5>

                <FileUploadStep v-model:files="uploadedFiles" @files-changed="onFilesChanged" />

                <div class="step-actions q-mt-xl">
                  <q-btn
                    color="primary"
                    label="Upload & Continue"
                    icon-right="arrow_forward"
                    :disable="uploadedFiles.length === 0"
                    :loading="isUploading"
                    @click="uploadFilesAndContinue"
                  />
                </div>
              </div>

              <!-- Step 2: Set AI Prompt -->
              <div v-if="currentStep === 2" class="step-panel">
                <h5 class="q-mt-none q-mb-lg text-grey-8">Step 2: Add Processing Prompts</h5>

                <PromptStep ref="promptStepRef" />

                <div class="step-actions q-mt-xl">
                  <q-btn
                    flat
                    color="grey"
                    label="Back"
                    icon="arrow_back"
                    @click="prevStep"
                    class="q-mr-sm"
                  />
                  <q-btn
                    color="primary"
                    label="Start Processing"
                    icon-right="play_arrow"
                    :disable="!canSubmitPrompts"
                    :loading="wizardStore.isLoading"
                    @click="submitPromptsAndProcess"
                  />
                </div>
              </div>

              <!-- Step 3: Processing Options -->
              <div v-if="currentStep === 3" class="step-panel">
                <h5 class="q-mt-none q-mb-lg text-grey-8">Step 3: Processing Options</h5>

                <ProcessingOptionsStep
                  v-model:selectedModels="selectedModels"
                  v-model:outputFormat="outputFormat"
                  v-model:outputPath="outputPath"
                  :processing-type="processingType"
                  @options-changed="onOptionsChanged"
                />

                <div class="step-actions q-mt-xl">
                  <q-btn
                    flat
                    color="grey"
                    label="Back"
                    icon="arrow_back"
                    @click="prevStep"
                    class="q-mr-sm"
                  />
                  <q-btn
                    color="primary"
                    label="Start Processing"
                    icon-right="play_arrow"
                    :disable="selectedModels.length === 0"
                    @click="startProcessing"
                  />
                </div>
              </div>

              <!-- Step 4: Results -->
              <div v-if="currentStep === 4" class="step-panel">
                <h5 class="q-mt-none q-mb-lg text-grey-8">Step 4: Results</h5>

                <ResultsStep
                  :processing-results="processingResults"
                  :is-processing="isProcessing"
                  @restart="restartWizard"
                />
              </div>
            </div>
          </div>

          <!-- Fullscreen Document Viewer Dialog -->
          <q-dialog v-model="isFullscreen" maximized>
            <q-card>
              <q-bar class="bg-primary text-white">
                <q-icon name="description" />
                <div class="q-ml-sm">{{ selectedFile?.filename || 'Document Preview' }}</div>
                <q-space />
                <q-btn dense flat icon="close" v-close-popup />
              </q-bar>

              <q-card-section class="q-pa-none fullscreen-viewer">
                <DocumentViewer
                  v-if="selectedFile && selectedLocalFile"
                  :file="selectedLocalFile"
                  :filename="selectedFile.filename"
                  :mime-type="selectedFile.mimeType"
                />
              </q-card-section>
            </q-card>
          </q-dialog>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useWizardStore } from 'src/stores/wizard.store';
// Import all the step components
import FileUploadStep from '../components/wizard/FileUpload.vue';
import PromptStep from '../components/wizard/PromptStep.vue';
import ProcessingOptionsStep from '../components/wizard/ProcessingOptionsStep.vue';
import ResultsStep from '../components/wizard/ResultsStep.vue';
import DocumentViewer from '../components/wizard/DocumentViewer.vue';

const $q = useQuasar();
const wizardStore = useWizardStore();

const currentStep = ref(1);
const uploadedFiles = ref<File[]>([]);
const isUploading = ref(false);
const promptStepRef = ref();
const aiPrompt = ref('');
const selectedModels = ref<string[]>([]);
const outputFormat = ref('pdf');
const outputPath = ref('');
const processingResults = ref<unknown[]>([]);
const isProcessing = ref(false);

// Document viewer state
const selectedFileIndex = ref(0);
const isFullscreen = ref(false);
const currentPage = ref(1);
const pdfNumPages = ref(0);

const processingType = computed(() => {
  if (uploadedFiles.value.length === 0) return 'single';
  if (uploadedFiles.value.length === 1) return 'single';
  return 'merge';
});

const canSubmitPrompts = computed(() => {
  const prompts = promptStepRef.value?.prompts || [];
  return prompts.length > 0 && promptStepRef.value?.validate?.();
});

// Document viewer computed
const selectedFile = computed(() => {
  if (wizardStore.uploadedFiles.length === 0) return null;
  return wizardStore.uploadedFiles[selectedFileIndex.value] || null;
});

const selectedLocalFile = computed(() => {
  if (wizardStore.localFiles.length === 0) return null;
  return wizardStore.localFiles[selectedFileIndex.value] || null;
});

const fileSelectOptions = computed(() => {
  return wizardStore.uploadedFiles.map((file, index) => ({
    label: file.filename,
    value: index,
  }));
});

// Document viewer methods
function isPDF(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

function onPdfLoaded(data: { numPages: number }) {
  pdfNumPages.value = data.numPages;
  currentPage.value = 1;
}

function onPageChanged(page: number) {
  currentPage.value = page;
}

function nextPage() {
  if (currentPage.value < pdfNumPages.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

const onFilesChanged = (files: File[]) => {
  uploadedFiles.value = files;
};

const onPromptChanged = (prompt: string) => {
  aiPrompt.value = prompt;
};

interface ProcessingOptions {
  selectedModels: string[];
  outputFormat: string;
  outputPath: string;
}

const onOptionsChanged = (options: ProcessingOptions) => {
  selectedModels.value = options.selectedModels;
  outputFormat.value = options.outputFormat;
  outputPath.value = options.outputPath;
};

async function uploadFilesAndContinue() {
  try {
    isUploading.value = true;
    await wizardStore.uploadFiles(uploadedFiles.value);

    $q.notify({
      type: 'positive',
      message: 'Files uploaded successfully! Session created.',
      icon: 'check_circle',
      position: 'top',
      timeout: 3000,
    });

    currentStep.value = 2;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Upload failed',
      icon: 'error',
      position: 'top',
      timeout: 5000,
    });
  } finally {
    isUploading.value = false;
  }
}

async function submitPromptsAndProcess() {
  const prompts = promptStepRef.value?.prompts || [];

  if (prompts.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Please add at least one prompt',
      icon: 'warning',
      position: 'top',
    });
    return;
  }

  try {
    await wizardStore.submitPrompts(prompts);

    $q.notify({
      type: 'positive',
      message: 'Processing started! Please wait...',
      icon: 'sync',
      position: 'top',
      timeout: 3000,
    });

    currentStep.value = 3;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to submit prompts',
      icon: 'error',
      position: 'top',
      timeout: 5000,
    });
  }
}

const nextStep = () => {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
};

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

const startProcessing = () => {
  currentStep.value = 4;
  isProcessing.value = true;

  // Simulate processing
  setTimeout(() => {
    isProcessing.value = false;
    processingResults.value = [
      {
        model: 'llama3.1',
        success: true,
        outputPath: '/documents/processed_document_llama3.1.pdf',
        message: 'Document processed successfully',
      },
      {
        model: 'mistral',
        success: true,
        outputPath: '/documents/processed_document_mistral.pdf',
        message: 'Document processed successfully',
      },
    ];
  }, 3000);
};

const restartWizard = () => {
  currentStep.value = 1;
  uploadedFiles.value = [];
  aiPrompt.value = '';
  selectedModels.value = [];
  outputPath.value = '';
  processingResults.value = [];
  isProcessing.value = false;
};
</script>

<style lang="scss" scoped>
// Wrapper containing both viewer and wizard
.wizard-wrapper {
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 900px;
  min-height: 600px;

  &.with-viewer {
    max-width: 1400px;
  }
}

// Document Viewer Panel (left side)
.document-viewer-panel {
  width: 500px;
  flex-shrink: 0;
  background: #2c3e50; // Dark background like Figma
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .viewer-header {
    background: #34495e;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1a252f;
    flex-shrink: 0;

    .header-top {
      display: flex;
      align-items: center;
      color: #ecf0f1;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.75rem;

      .header-title {
        color: #ecf0f1;
      }

      .q-icon {
        color: #bdc3c7;
      }
    }

    .file-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;

      .file-tab {
        display: flex;
        align-items: center;
        padding: 0.375rem 0.75rem;
        background: #2c3e50;
        border: 1px solid #1a252f;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.8125rem;
        color: #95a5a6;

        .q-icon {
          color: #7f8c8d;
        }

        &.active {
          background: #1a252f;
          border-color: #3498db;
          color: #ecf0f1;

          .q-icon {
            color: #3498db;
          }
        }

        &:hover:not(.active) {
          background: #34495e;
          border-color: #34495e;
        }

        .file-tab-label {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .page-navigation {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .nav-btn {
        color: #ecf0f1;

        &:disabled {
          color: #7f8c8d;
        }
      }

      .page-indicator {
        color: #bdc3c7;
        font-size: 0.8125rem;
        min-width: 50px;
        text-align: center;
      }
    }
  }

  .q-separator {
    background: #1a252f;
  }

  .viewer-content-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
    background: #2c3e50;

    :deep(.document-viewer) {
      height: 100%;
    }
  }

  .no-file-selected {
    color: #95a5a6;
  }
}

// Main Wizard Container (right side)
.wizard-container {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  min-height: 600px;
  display: flex;
  flex-direction: column;
}

.wizard-header {
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f4 100%);
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
}

.progress-container {
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
  flex-shrink: 0;
}

.step-content {
  padding: 2rem;
  min-height: 400px;
  flex: 1;
  overflow-y: auto;
}

.step-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 2rem;
  border-top: 1px solid #f0f0f0;
}

:deep(.q-stepper__header) {
  box-shadow: none;
}

:deep(.q-stepper__step-inner) {
  padding: 0;
}

.no-file-selected {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 300px;
}

.fullscreen-viewer {
  height: calc(100vh - 50px);

  :deep(.document-viewer) {
    height: 100%;
  }
}

// Responsive
@media (max-width: 1400px) {
  .wizard-wrapper.with-viewer {
    max-width: 95vw;
  }

  .document-viewer-panel {
    width: 400px;
  }
}

@media (max-width: 1024px) {
  .wizard-wrapper {
    flex-direction: column;

    &.with-viewer {
      max-width: 900px;
    }
  }

  .document-viewer-panel {
    width: 100%;
    height: 400px;
  }
}
</style>
