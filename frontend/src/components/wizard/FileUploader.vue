<template>
  <div class="file-uploader">
    <!-- Upload Area -->
    <div
      class="drop-zone"
      :class="{
        'drop-zone-active': isDragging,
        'drop-zone-uploading': isUploading
      }"
      @drop.prevent="onDrop"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="acceptedTypes"
        style="display: none"
        @change="onFileInputChange"
      />

      <div class="drop-zone-content">
        <div v-if="!isUploading" class="upload-prompt">
          <div class="icon-wrapper">
            <q-icon :name="isDragging ? 'download' : 'cloud_upload'" size="80px" class="upload-icon" />
          </div>
          <h3 class="upload-title">
            {{ isDragging ? 'Drop files here!' : 'Drop files or click to upload' }}
          </h3>
          <p class="upload-subtitle">
            Supported: PDF, Word, Excel, Text, CSV
          </p>
          <p class="upload-limits">
            Max 25MB per file • 100MB total
          </p>
        </div>

        <div v-else class="upload-progress-section">
          <q-spinner-pie
            color="primary"
            size="80px"
            :thickness="8"
            class="upload-spinner"
          />
          <h3 class="upload-title">Uploading your files...</h3>
          <div class="progress-bar-wrapper">
            <q-linear-progress
              :value="uploadProgress"
              color="primary"
              size="12px"
              class="upload-progress-bar"
              rounded
            />
            <span class="progress-text">{{ Math.round(uploadProgress * 100) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Successfully Uploaded Files -->
    <transition-group name="file-list" tag="div" v-if="uploadedFiles.length > 0" class="uploaded-files-section">
      <div key="header" class="files-header">
        <div class="files-header-content">
          <q-icon name="check_circle" color="positive" size="md" />
          <h4 class="files-title">Uploaded Files</h4>
          <q-chip outline color="primary" class="files-count">
            {{ uploadedFiles.length }} {{ uploadedFiles.length === 1 ? 'file' : 'files' }}
          </q-chip>
        </div>
        <q-chip
          v-if="totalTokens > 0"
          outline
          color="secondary"
          icon="memory"
          class="tokens-chip"
        >
          {{ formatNumber(totalTokens) }} tokens
        </q-chip>
      </div>

      <div
        v-for="file in uploadedFiles"
        :key="file.id"
        class="file-card"
      >
        <div class="file-icon-wrapper" :style="{ background: getFileColorGradient(file.mimeType) }">
          <q-icon :name="getFileIcon(file.mimeType)" color="white" size="32px" />
        </div>

        <div class="file-info">
          <div class="file-name">{{ file.filename }}</div>
          <div class="file-meta">
            <span class="meta-item">
              <q-icon name="folder" size="xs" />
              {{ formatFileSize(file.size) }}
            </span>
            <span v-if="file.tokenCount" class="meta-item">
              <q-icon name="data_usage" size="xs" />
              {{ formatNumber(file.tokenCount) }} tokens
            </span>
          </div>
        </div>

        <q-btn
          flat
          round
          icon="close"
          color="negative"
          size="sm"
          class="remove-btn"
          @click="removeUploadedFile(file.id)"
        >
          <q-tooltip>Remove file</q-tooltip>
        </q-btn>
      </div>
    </transition-group>

    <!-- Empty State -->
    <div v-if="uploadedFiles.length === 0 && !isUploading" class="empty-state">
      <q-icon name="info_outline" color="primary" size="md" />
      <p class="empty-text">No files uploaded yet. Drop files above or click the upload area.</p>
    </div>
  </div>
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

const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
const isDragging = ref(false);

const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.txt,.csv';
const maxFileSize = 25 * 1024 * 1024; // 25MB
const maxTotalSize = 100 * 1024 * 1024; // 100MB

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

function getFileColorGradient(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'linear-gradient(135deg, #e53e3e 0%, #fc8181 100%)';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'linear-gradient(135deg, #3182ce 0%, #63b3ed 100%)';
  if (mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('spreadsheet')) return 'linear-gradient(135deg, #38a169 0%, #68d391 100%)';
  if (mimeType.includes('csv')) return 'linear-gradient(135deg, #dd6b20 0%, #f6ad55 100%)';
  if (mimeType.includes('text')) return 'linear-gradient(135deg, #718096 0%, #a0aec0 100%)';
  return 'linear-gradient(135deg, #718096 0%, #a0aec0 100%)';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function triggerFileInput() {
  if (!isUploading.value) {
    fileInput.value?.click();
  }
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  if (files.length > 0) {
    processFiles(files);
  }
  // Reset input so the same files can be selected again if needed
  target.value = '';
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length > 0) {
    processFiles(files);
  }
}

function processFiles(files: File[]) {
  // Validate total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > maxTotalSize) {
    $q.notify({
      type: 'negative',
      message: `Total file size exceeds 100MB limit (current: ${formatFileSize(totalSize)})`,
      position: 'top',
      icon: 'error'
    });
    return;
  }

  // Validate individual file sizes
  const oversizedFiles = files.filter(f => f.size > maxFileSize);
  if (oversizedFiles.length > 0) {
    $q.notify({
      type: 'negative',
      message: `Some files exceed 25MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`,
      position: 'top',
      icon: 'error'
    });
    return;
  }

  // Auto-upload
  uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  isUploading.value = true;
  uploadProgress.value = 0;

  const formData = new FormData();
  files.forEach(file => {
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
  $q.dialog({
    title: 'Remove File',
    message: 'Are you sure you want to remove this file?',
    cancel: true,
    persistent: false
  }).onOk(() => {
    emit('remove-file', fileId);
    $q.notify({
      type: 'info',
      message: 'File removed',
      position: 'top',
      icon: 'delete'
    });
  });
}
</script>

<style scoped lang="scss">
.file-uploader {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.drop-zone {
  position: relative;
  min-height: 320px;
  border: 3px dashed #cbd5e0;
  border-radius: 20px;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.drop-zone::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.drop-zone:hover::before {
  opacity: 1;
}

.drop-zone:hover {
  border-color: #667eea;
  transform: scale(1.01);
  box-shadow: 0 10px 40px rgba(102, 126, 234, 0.15);
}

.drop-zone-active {
  border-color: #667eea;
  border-style: solid;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  transform: scale(1.02);
  box-shadow: 0 15px 50px rgba(102, 126, 234, 0.25);
}

.drop-zone-active::before {
  opacity: 1;
}

.drop-zone-uploading {
  pointer-events: none;
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
}

.drop-zone-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 3rem 2rem;
}

.upload-prompt,
.upload-progress-section {
  text-align: center;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.upload-icon {
  color: white;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.drop-zone-active .icon-wrapper {
  animation: pulse 1s ease infinite, float 3s ease-in-out infinite;
}

.upload-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.75rem;
}

.upload-subtitle {
  font-size: 1.1rem;
  color: #718096;
  margin: 0 0 0.5rem;
}

.upload-limits {
  font-size: 0.95rem;
  color: #a0aec0;
  margin: 0;
}

.upload-progress-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.upload-spinner {
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3));
}

.progress-bar-wrapper {
  width: 100%;
  max-width: 400px;
  position: relative;
}

.upload-progress-bar {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  font-size: 0.9rem;
  color: #2d3748;
}

/* Uploaded Files Section */
.uploaded-files-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
}

.files-header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.files-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.files-count {
  font-weight: 600;
}

.tokens-chip {
  font-weight: 600;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideInUp 0.5s ease;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.file-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border-color: #cbd5e0;
}

.file-icon-wrapper {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #718096;
  font-weight: 500;
}

.remove-btn {
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.file-card:hover .remove-btn {
  opacity: 1;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 12px;
  border: 2px solid #e2e8f0;
}

.empty-text {
  margin: 0.75rem 0 0;
  color: #718096;
  font-size: 1rem;
}

/* Transition animations for file list */
.file-list-enter-active,
.file-list-leave-active {
  transition: all 0.5s ease;
}

.file-list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.file-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.file-list-move {
  transition: transform 0.5s ease;
}

/* Responsive Design */
@media (max-width: 768px) {
  .drop-zone {
    min-height: 250px;
  }

  .icon-wrapper {
    width: 90px;
    height: 90px;
  }

  .upload-icon {
    font-size: 60px !important;
  }

  .upload-title {
    font-size: 1.4rem;
  }

  .files-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .file-card {
    flex-wrap: wrap;
  }
}
</style>
