<template>
  <q-dialog
    v-model="isOpen"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="viewer-modal-card modal-90">
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

        <!-- Right: Prompt Management (25%) -->
        <div class="prompt-section col-3 bg-grey-1 q-pa-md">
          <div class="prompts-header q-mb-md">
            <div class="text-h6 text-grey-8">Prompts ({{ localPrompts.length }})</div>
            <q-btn
              flat
              round
              dense
              icon="add"
              color="primary"
              size="sm"
              @click="addPrompt"
            >
              <q-tooltip>Add new prompt</q-tooltip>
            </q-btn>
          </div>

          <div v-if="localPrompts.length === 0" class="text-center q-pa-lg">
            <q-icon name="edit_note" size="3rem" color="grey-4" class="q-mb-sm" />
            <p class="text-grey-6 text-caption">No prompts yet. Click + to add.</p>
          </div>

          <div v-else class="prompts-list">
            <q-card
              v-for="(prompt, index) in localPrompts"
              :key="index"
              flat
              bordered
              class="prompt-item q-mb-md"
            >
              <q-card-section class="q-pa-sm">
                <div class="row items-center q-mb-xs">
                  <q-chip
                    :color="getTargetTypeColor(prompt.targetType)"
                    text-color="white"
                    size="sm"
                  >
                    {{ formatTargetType(prompt.targetType) }}
                  </q-chip>
                  <q-space />
                  <q-btn
                    flat
                    round
                    dense
                    icon="edit"
                    color="primary"
                    size="xs"
                    @click="editingPromptIndex = editingPromptIndex === index ? null : index"
                  >
                    <q-tooltip>{{ editingPromptIndex === index ? 'Close' : 'Edit' }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    size="xs"
                    @click="removePrompt(index)"
                  >
                    <q-tooltip>Delete</q-tooltip>
                  </q-btn>
                </div>

                <!-- View Mode -->
                <div v-if="editingPromptIndex !== index">
                  <div class="text-caption text-grey-7">Content:</div>
                  <div class="text-body2 q-mb-xs ellipsis-multiline">{{ prompt.content || 'Empty' }}</div>
                  <div class="text-caption text-grey-7">Priority: {{ prompt.priority }}</div>
                </div>

                <!-- Edit Mode -->
                <div v-else class="q-mt-sm">
                  <q-input
                    v-model="prompt.content"
                    type="textarea"
                    label="Prompt Content"
                    dense
                    outlined
                    rows="3"
                    class="q-mb-sm"
                  />
                  <div class="row q-col-gutter-xs q-mb-sm">
                    <div class="col-6">
                      <q-input
                        v-model.number="prompt.priority"
                        type="number"
                        label="Priority"
                        dense
                        outlined
                        min="0"
                      />
                    </div>
                    <div class="col-6">
                      <q-select
                        v-model="prompt.targetType"
                        :options="targetTypeOptions"
                        label="Target"
                        dense
                        outlined
                        emit-value
                        map-options
                      />
                    </div>
                  </div>

                  <!-- File selector for FILE_SPECIFIC -->
                  <div v-if="prompt.targetType === 'FILE_SPECIFIC' || prompt.targetType === 'LINE_SPECIFIC'">
                    <q-select
                      v-model="prompt.targetFileId"
                      :options="fileOptions"
                      label="Target File"
                      dense
                      outlined
                      emit-value
                      map-options
                      class="q-mb-sm"
                    />
                  </div>

                  <!-- Line range for LINE_SPECIFIC -->
                  <div v-if="prompt.targetType === 'LINE_SPECIFIC'" class="row q-col-gutter-xs q-mb-sm">
                    <div class="col-6">
                      <q-input
                        v-model.number="prompt.targetLines!.start"
                        type="number"
                        label="Start Line"
                        dense
                        outlined
                        min="1"
                      />
                    </div>
                    <div class="col-6">
                      <q-input
                        v-model.number="prompt.targetLines!.end"
                        type="number"
                        label="End Line"
                        dense
                        outlined
                        min="1"
                      />
                    </div>
                  </div>

                  <!-- Section for SECTION_SPECIFIC -->
                  <div v-if="prompt.targetType === 'SECTION_SPECIFIC'">
                    <q-input
                      v-model="prompt.targetSection"
                      label="Section Name"
                      dense
                      outlined
                      class="q-mb-sm"
                    />
                  </div>

                  <q-btn
                    flat
                    label="Done"
                    color="positive"
                    size="sm"
                    @click="editingPromptIndex = null"
                    class="full-width"
                  />
                </div>
              </q-card-section>
            </q-card>
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
  prompts?: PromptInput[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:selectedFileId': [fileId: string];
  'update:prompts': [prompts: PromptInput[]];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const currentFileId = ref<string | null>(props.selectedFileId || null);
const localPrompts = ref<PromptInput[]>(props.prompts || []);
const editingPromptIndex = ref<number | null>(null);

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

// Watch for prompts prop changes
watch(
  () => props.prompts,
  (newPrompts) => {
    if (newPrompts) {
      localPrompts.value = [...newPrompts];
    }
  },
  { deep: true, immediate: true }
);

// Emit prompt changes
watch(
  localPrompts,
  (newPrompts) => {
    emit('update:prompts', newPrompts);
  },
  { deep: true }
);

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

const targetTypeOptions = [
  { label: 'Global', value: 'GLOBAL' },
  { label: 'File', value: 'FILE_SPECIFIC' },
  { label: 'Lines', value: 'LINE_SPECIFIC' },
  { label: 'Section', value: 'SECTION_SPECIFIC' },
];

function addPrompt() {
  localPrompts.value.push({
    content: '',
    priority: localPrompts.value.length + 1,
    targetType: 'GLOBAL',
    targetLines: { start: 1, end: 10 },
  });
  editingPromptIndex.value = localPrompts.value.length - 1;
}

function removePrompt(index: number) {
  localPrompts.value.splice(index, 1);
  // Reorder priorities
  localPrompts.value.forEach((p, i) => {
    p.priority = i + 1;
  });
  if (editingPromptIndex.value === index) {
    editingPromptIndex.value = null;
  }
}

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
.modal-90 {
  width: 90vw;
  height: 90vh;
  max-width: 90vw;
  max-height: 90vh;
}

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

  .prompts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prompts-list {
    max-height: calc(100vh - 400px);
    overflow-y: auto;
  }

  .prompt-item {
    transition: all 0.2s ease;

    &:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.1);
    }
  }
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ellipsis-multiline {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
