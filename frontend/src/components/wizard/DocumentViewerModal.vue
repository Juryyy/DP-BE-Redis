<template>
  <q-dialog
    v-model="isOpen"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="viewer-modal-card">
      <!-- Header -->
      <q-card-section class="modal-header row items-center q-pa-md bg-grey-2">
        <q-icon name="visibility" size="sm" color="primary" class="q-mr-sm" />
        <div class="text-h6 text-grey-8">Document Viewer</div>
        <q-space />
        <q-select
          v-model="currentFileId"
          :options="fileOptions"
          label="Select File"
          outlined
          dense
          emit-value
          map-options
          bg-color="white"
          style="min-width: 250px"
          class="q-mr-md"
        >
          <template #prepend>
            <q-icon name="description" color="primary" size="xs" />
          </template>
        </q-select>
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
          color="grey-7"
        />
      </q-card-section>

      <!-- Main Content - Split View -->
      <q-card-section class="modal-content row no-wrap q-pa-none">
        <!-- Left: Document Viewer (75%) -->
        <div class="document-section col-9">
          <DocumentViewer
            v-if="currentFile"
            :file-url="currentFile.url"
            :filename="currentFile.filename"
            :mime-type="currentFile.mimeType"
          />
          <div v-else class="no-document q-pa-lg text-center">
            <q-icon name="insert_drive_file" size="4rem" color="grey-4" class="q-mb-md" />
            <p class="text-grey-6">No file selected</p>
          </div>
        </div>

        <!-- Right: Prompt Info (25%) -->
        <div class="prompt-section col-3 bg-grey-1 q-pa-md">
          <div class="text-h6 text-grey-8 q-mb-md">Current Prompt</div>

          <div v-if="currentPrompt">
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="text-caption text-grey-7 q-mb-xs">Prompt Content:</div>
                <div class="text-body2 q-mb-md">{{ currentPrompt.content }}</div>

                <div class="text-caption text-grey-7 q-mb-xs">Priority:</div>
                <q-chip size="sm" color="primary" text-color="white">
                  {{ currentPrompt.priority }}
                </q-chip>

                <div class="text-caption text-grey-7 q-mt-md q-mb-xs">Target Type:</div>
                <q-chip
                  size="sm"
                  :color="getTargetTypeColor(currentPrompt.targetType)"
                  text-color="white"
                >
                  {{ formatTargetType(currentPrompt.targetType) }}
                </q-chip>

                <div v-if="currentPrompt.targetType === 'LINE_SPECIFIC' && currentPrompt.targetLines" class="q-mt-md">
                  <div class="text-caption text-grey-7 q-mb-xs">Line Range:</div>
                  <div class="text-body2">
                    Lines {{ currentPrompt.targetLines.start }} - {{ currentPrompt.targetLines.end }}
                  </div>
                </div>

                <div v-if="currentPrompt.targetType === 'SECTION_SPECIFIC' && currentPrompt.targetSection" class="q-mt-md">
                  <div class="text-caption text-grey-7 q-mb-xs">Section:</div>
                  <div class="text-body2">{{ currentPrompt.targetSection }}</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div v-else class="text-center q-pa-lg">
            <q-icon name="edit_note" size="3rem" color="grey-4" class="q-mb-sm" />
            <p class="text-grey-6 text-caption">No prompt selected</p>
          </div>

          <!-- File Info -->
          <q-card flat bordered v-if="currentFile">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8 q-mb-sm">File Information</div>
              <div class="text-caption text-grey-7 q-mb-xs">Filename:</div>
              <div class="text-body2 q-mb-sm ellipsis">{{ currentFile.filename }}</div>

              <div class="text-caption text-grey-7 q-mb-xs">Size:</div>
              <div class="text-body2 q-mb-sm">{{ formatFileSize(currentFile.size) }}</div>

              <div class="text-caption text-grey-7 q-mb-xs">Type:</div>
              <div class="text-body2">{{ currentFile.mimeType }}</div>

              <div v-if="currentFile.tokenCount" class="q-mt-sm">
                <div class="text-caption text-grey-7 q-mb-xs">Tokens:</div>
                <q-chip size="sm" color="blue-grey-3">
                  {{ currentFile.tokenCount.toLocaleString() }}
                </q-chip>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DocumentViewer from './DocumentViewer.vue';
import type { UploadedFile } from 'src/types/file.types';
import type { PromptInput, TargetType } from 'src/types/wizard.types';

const props = defineProps<{
  modelValue: boolean;
  files: UploadedFile[];
  selectedFileId?: string;
  prompt?: PromptInput;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:selectedFileId': [fileId: string];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const currentFileId = ref<string | null>(props.selectedFileId || null);
const currentPrompt = computed(() => props.prompt);

// Watch for selectedFileId prop changes
watch(
  () => props.selectedFileId,
  (newFileId) => {
    if (newFileId) {
      currentFileId.value = newFileId;
    }
  },
  { immediate: true }
);

// Auto-select first file if none selected
watch(
  () => props.files,
  (files) => {
    if (files.length > 0 && !currentFileId.value) {
      currentFileId.value = files[0].id;
    }
  },
  { immediate: true }
);

// Emit file changes
watch(currentFileId, (newFileId) => {
  if (newFileId) {
    emit('update:selectedFileId', newFileId);
  }
});

const fileOptions = computed(() => {
  return props.files.map((file) => ({
    label: file.filename,
    value: file.id,
  }));
});

const currentFile = computed(() => {
  if (!currentFileId.value) return null;
  return props.files.find((file) => file.id === currentFileId.value) || null;
});

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getTargetTypeColor(targetType: TargetType): string {
  const colors: Record<TargetType, string> = {
    GLOBAL: 'blue-6',
    FILE_SPECIFIC: 'green-6',
    LINE_SPECIFIC: 'orange-6',
    SECTION_SPECIFIC: 'purple-6',
  };
  return colors[targetType] || 'grey';
}

function formatTargetType(targetType: TargetType): string {
  const labels: Record<TargetType, string> = {
    GLOBAL: 'Global',
    FILE_SPECIFIC: 'File',
    LINE_SPECIFIC: 'Lines',
    SECTION_SPECIFIC: 'Section',
  };
  return labels[targetType] || targetType;
}
</script>

<style lang="scss" scoped>
.viewer-modal-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.modal-header {
  flex-shrink: 0;
  border-bottom: 2px solid #e5e7eb;
}

.modal-content {
  flex: 1;
  overflow: hidden;
}

.document-section {
  border-right: 2px solid #e5e7eb;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.no-document {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.prompt-section {
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;

    &:hover {
      background: #555;
    }
  }
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
