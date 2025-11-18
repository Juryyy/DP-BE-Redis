<template>
  <q-card flat bordered class="file-uploader-card">
    <q-card-section>
      <div class="text-h5 q-mb-xs">
        <q-icon name="cloud_upload" size="sm" class="q-mr-sm" />
        Upload Documents
      </div>
      <div class="text-body2 text-grey-7">
        Upload your documents for AI processing. Supported formats: PDF, Word, Excel, Text, and CSV.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-file
        v-model="selectedFiles"
        label="Select files to upload"
        multiple
        filled
        counter
        :max-file-size="maxFileSize"
        :accept="acceptedTypes"
        @update:model-value="onFilesSelected"
      >
        <template #prepend>
          <q-icon name="attach_file" />
        </template>

        <template #hint>
          Max file size: 25MB per file, 100MB total. Supported: PDF, DOCX, XLSX, TXT, CSV
        </template>

        <template #after>
          <q-btn
            round
            dense
            flat
            icon="cloud_upload"
            color="primary"
            :disable="!selectedFiles || selectedFiles.length === 0 || isUploading"
            :loading="isUploading"
            @click="uploadFiles"
          >
            <q-tooltip>Upload selected files</q-tooltip>
          </q-btn>
        </template>
      </q-file>

      <!-- Drag and Drop Area -->
      <div
        class="drop-zone q-mt-md"
        :class="{ 'drop-zone-active': isDragging }"
        @drop.prevent="onDrop"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
      >
        <div class="text-center q-pa-xl">
          <q-icon name="cloud_upload" size="64px" color="grey-5" />
          <div class="text-h6 text-grey-7 q-mt-md">Drag and drop files here</div>
          <div class="text-caption text-grey-6">or use the file selector above</div>
        </div>
      </div>
    </q-card-section>

    <!-- Upload Progress -->
    <q-card-section v-if="isUploading">
      <q-linear-progress :value="uploadProgress" color="primary" class="q-mt-sm" />
      <div class="text-caption text-center q-mt-xs">
        Uploading... {{ Math.round(uploadProgress * 100) }}%
      </div>
    </q-card-section>

    <!-- Successfully Uploaded Files -->
    <q-card-section v-if="uploadedFiles.length > 0">
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">
            <q-icon name="check_circle" color="positive" class="q-mr-sm" />
            Uploaded Files ({{ uploadedFiles.length }})
          </div>
        </div>
        <div class="col-auto">
          <q-chip
            outline
            color="primary"
            icon="memory"
            :label="`${formatNumber(totalTokens)} tokens`"
          />
        </div>
      </div>

      <q-list bordered separator class="rounded-borders">
        <q-item
          v-for="file in uploadedFiles"
          :key="file.id"
          class="uploaded-file-item"
        >
          <q-item-section avatar>
            <q-avatar
              :icon="getFileIcon(file.mimeType)"
              :color="getFileColor(file.mimeType)"
              text-color="white"
              size="48px"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium">{{ file.filename }}</q-item-label>
            <q-item-label caption class="q-mt-xs">
              <q-icon name="folder" size="xs" class="q-mr-xs" />
              {{ formatFileSize(file.size) }}
              <span v-if="file.tokenCount" class="q-ml-md">
                <q-icon name="data_usage" size="xs" class="q-mr-xs" />
                {{ formatNumber(file.tokenCount) }} tokens
              </span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn
              flat
              dense
              round
              icon="delete"
              color="negative"
              @click="removeUploadedFile(file.id)"
            >
              <q-tooltip>Remove file</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <!-- Empty State -->
    <q-card-section v-if="uploadedFiles.length === 0 && !selectedFiles">
      <q-banner rounded class="bg-grey-2">
        <template #avatar>
          <q-icon name="info" color="primary" />
        </template>
        <div class="text-body2">
          No files uploaded yet. Select files above or drag and drop them into the designated area.
        </div>
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'boot/axios';
import type { UploadedFile, FileUploadEvent } from 'src/types/file.types';

const props = defineProps<{
  uploadedFiles: UploadedFile[];
  sessionId: string | null;
}>();

const emit = defineEmits<{
  (e: 'upload-success', data: FileUploadEvent): void;
  (e: 'upload-failed', error: string): void;
  (e: 'remove-file', fileId: string): void;
}>();

const $q = useQuasar();

const selectedFiles = ref<File[] | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const isDragging = ref(false);

const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.txt,.csv';
const maxFileSize = 25 * 1024 * 1024; // 25MB

const totalTokens = computed(() => {
  return props.uploadedFiles.reduce((sum, file) => sum + (file.tokenCount || 0), 0);
});

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'picture_as_pdf';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'description';
  if (mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('spreadsheet')) return 'table_chart';
  if (mimeType.includes('csv')) return 'grid_on';
  if (mimeType.includes('text')) return 'article';
  return 'insert_drive_file';
}

function getFileColor(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'red';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'blue';
  if (mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('spreadsheet')) return 'green';
  if (mimeType.includes('csv')) return 'orange';
  if (mimeType.includes('text')) return 'grey';
  return 'grey';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function onFilesSelected(files: File[] | null) {
  if (!files || files.length === 0) return;

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const maxTotalSize = 100 * 1024 * 1024; // 100MB

  if (totalSize > maxTotalSize) {
    $q.notify({
      type: 'negative',
      message: `Total file size exceeds 100MB limit (current: ${formatFileSize(totalSize)})`,
      position: 'top'
    });
    selectedFiles.value = null;
    return;
  }

  $q.notify({
    type: 'info',
    message: `${files.length} file(s) selected (${formatFileSize(totalSize)})`,
    position: 'top'
  });
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    selectedFiles.value = files;
    onFilesSelected(files);
  }
}

async function uploadFiles() {
  if (!selectedFiles.value || selectedFiles.value.length === 0) return;

  isUploading.value = true;
  uploadProgress.value = 0;

  const formData = new FormData();
  selectedFiles.value.forEach(file => {
    formData.append('files', file);
  });

  try {
    const response = await api.post('/api/wizard/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = progressEvent.loaded / progressEvent.total;
        }
      }
    });

    if (response.data.success) {
      emit('upload-success', {
        sessionId: response.data.data.sessionId,
        files: response.data.data.files
      });

      $q.notify({
        type: 'positive',
        message: `Successfully uploaded ${response.data.data.files.length} file(s)`,
        icon: 'check_circle',
        position: 'top'
      });

      selectedFiles.value = null;
    } else {
      throw new Error(response.data.error || 'Upload failed');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
    emit('upload-failed', errorMsg);

    $q.notify({
      type: 'negative',
      message: `Upload failed: ${errorMsg}`,
      icon: 'error',
      position: 'top'
    });
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
  }
}

function removeUploadedFile(fileId: string) {
  emit('remove-file', fileId);
  $q.notify({
    type: 'info',
    message: 'File removed',
    position: 'top'
  });
}
</script>

<style scoped>
.file-uploader-card {
  min-height: 400px;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.drop-zone:hover {
  border-color: var(--q-primary);
  background-color: rgba(var(--q-primary-rgb), 0.05);
}

.drop-zone-active {
  border-color: var(--q-primary);
  background-color: rgba(var(--q-primary-rgb), 0.1);
  border-style: solid;
}

.uploaded-file-item {
  transition: background-color 0.2s ease;
}

.uploaded-file-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}
</style>
