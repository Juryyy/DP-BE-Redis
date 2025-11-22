<template>
  <div class="file-upload-container">
    <!-- Hidden QFile for functionality -->
    <q-file
      ref="qFileRef"
      v-model="fileModel"
      multiple
      accept=".pdf,.docx,.txt,.csv,.xlsx,.pptx,.md,.rtf"
      :max-file-size="maxFileSize"
      @update:model-value="handleFilesUpdate"
      @rejected="onRejected"
      style="display: none"
    />

    <!-- Custom Upload Zone -->
    <div
      class="upload-zone"
      :class="{ 'drag-over': isDragOver }"
      @drop="handleDrop"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @dragenter.prevent="onDragEnter"
      @click="triggerFileInput"
    >
      <div class="upload-content">
        <q-icon
          name="cloud_upload"
          size="2.5rem"
          :color="isDragOver ? 'primary' : 'grey-5'"
          class="q-mb-xs upload-icon"
          :class="{ bounce: isDragOver }"
        />
        <h6 class="text-grey-7 q-ma-none q-mb-xs upload-title">
          {{ isDragOver ? 'Drop files here' : 'Drag and drop files' }}
        </h6>
        <p class="text-grey-5 q-ma-none q-mb-sm upload-subtitle">or</p>
        <q-btn
          color="primary"
          label="Browse"
          icon="folder_open"
          @click.stop="triggerFileInput"
          unelevated
          size="xs"
          class="upload-button"
        />
        <p class="text-grey-5 q-mt-xs q-ma-none upload-hint">
          PDF, DOCX, TXT, CSV, XLSX, PPTX, MD, RTF (Max {{ maxFileSize / 1024 / 1024 }}MB)
        </p>
      </div>
    </div>

    <!-- Previously Uploaded Files (from store) -->
    <div v-if="hasUploadedFiles" class="uploaded-files q-mt-sm">
      <div class="files-header q-mb-xs">
        <span class="text-positive text-caption">
          <q-icon name="check_circle" size="xs" class="q-mr-xs" />
          {{ uploadedFiles.length }} file(s) from previous upload
        </span>
      </div>

      <q-list bordered separator class="rounded-borders files-list uploaded-list">
        <q-item v-for="file in uploadedFiles" :key="file.id" class="file-item">
          <q-item-section avatar>
            <q-icon
              :name="getFileIcon(file.filename)"
              :color="getFileColor(file.filename)"
              size="sm"
              class="file-icon"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium file-name">
              {{ file.filename }}
            </q-item-label>
            <q-item-label caption class="file-details">
              {{ formatFileSize(file.size) }} • {{ getFileExtension(file.filename).toUpperCase() }}
              <span v-if="file.sections && file.sections.length > 0" class="q-ml-xs">
                • {{ file.sections.length }} section(s)
              </span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-badge color="positive" label="Previous Upload" />
          </q-item-section>
        </q-item>
      </q-list>

      <div v-if="selectedFiles.length === 0" class="q-mt-sm">
        <q-banner rounded class="bg-blue-1">
          <template #avatar>
            <q-icon name="info" color="primary" />
          </template>
          <div class="text-caption">
            <strong>Click "Continue"</strong> to proceed with these files, or <strong>select files below</strong> to upload a new set (select ALL files you want, including previous ones if you want to keep them).
          </div>
        </q-banner>
      </div>

      <div v-else class="q-mt-sm">
        <q-banner rounded class="bg-orange-1">
          <template #avatar>
            <q-icon name="warning" color="warning" />
          </template>
          <div class="text-caption">
            <strong>Note:</strong> Uploading will create a new session with ONLY the {{ selectedFiles.length }} file(s) selected below. Previous files will NOT be included unless you select them again.
          </div>
        </q-banner>
      </div>
    </div>

    <!-- Selected Files List -->
    <div v-if="selectedFiles.length > 0" class="selected-files q-mt-sm">
      <div class="files-header q-mb-xs">
        <span class="text-grey-8 text-caption">{{ selectedFiles.length }} file(s) selected</span>
        <q-btn
          flat
          dense
          icon="clear_all"
          color="grey-6"
          @click="clearAllFiles"
          size="xs"
          label="Clear"
        />
      </div>

      <q-list bordered separator class="rounded-borders files-list">
        <q-item v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <q-item-section avatar>
            <q-icon
              :name="getFileIcon(file.name)"
              :color="getFileColor(file.name)"
              size="sm"
              class="file-icon"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium file-name">
              {{ file.name }}
            </q-item-label>
            <q-item-label caption class="file-details">
              {{ formatFileSize(file.size) }} • {{ getFileExtension(file.name).toUpperCase() }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn
              flat
              round
              icon="close"
              color="grey-6"
              size="xs"
              @click="removeFile(index)"
              class="remove-btn"
            >
              <q-tooltip>Remove</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Upload Progress -->
    <div v-if="isUploading" class="upload-progress q-mt-sm">
      <q-linear-progress
        :value="uploadProgress"
        color="primary"
        size="6px"
        rounded
        class="progress-bar"
      />
      <p class="text-center q-mt-xs text-grey-6 progress-text">
        Processing files... {{ Math.round(uploadProgress * 100) }}%
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { api } from 'boot/axios';
import type { UploadedFile } from 'src/types/file.types';

// Props & Emits
const props = defineProps<{
  uploadedFiles: UploadedFile[];
  sessionId: string | null;
}>();

const emit = defineEmits<{
  'upload-success': [data: { sessionId: string; files: UploadedFile[] }];
  'upload-failed': [error: string];
  'remove-file': [fileId: string];
}>();

// Quasar
const $q = useQuasar();

// Component state
const qFileRef = ref();
const fileModel = ref<File | File[] | null>(null);
const isDragOver = ref(false);
const isUploading = ref(false);
const uploadProgress = ref(0);
const dragCounter = ref(0);
const maxFileSize = 1024 * 1024 * 25; // 25MB
const selectedFiles = ref<File[]>([]);

// Track if we've already uploaded these files
const hasUploadedFiles = computed(() => props.uploadedFiles.length > 0);

// Check if current selection matches uploaded files
const filesMatchUploaded = computed(() => {
  if (!hasUploadedFiles.value || selectedFiles.value.length === 0) return false;
  if (selectedFiles.value.length !== props.uploadedFiles.length) return false;

  // Compare filenames and sizes
  const selectedNames = new Set(selectedFiles.value.map(f => `${f.name}:${f.size}`));
  const uploadedNames = new Set(props.uploadedFiles.map(f => `${f.filename}:${f.size}`));

  return selectedNames.size === uploadedNames.size &&
         [...selectedNames].every(name => uploadedNames.has(name));
});

// Initialize from uploaded files when component mounts or when navigating back
onMounted(() => {
  // If we have uploaded files in the store but no selected files locally,
  // it means we're returning from a later step - no need to re-select
  // Just show that files are already uploaded
});

// File handling methods
const triggerFileInput = () => {
  qFileRef.value?.pickFiles();
};

const handleFilesUpdate = (files: File | File[] | null) => {
  if (!files) return;

  const fileArray = Array.isArray(files) ? files : [files];
  addFiles(fileArray);
};

// Drag and drop handlers
const onDragEnter = (e: DragEvent) => {
  e.preventDefault();
  dragCounter.value++;
  isDragOver.value = true;
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = true;
};

const onDragLeave = (e: DragEvent) => {
  e.preventDefault();
  dragCounter.value--;
  if (dragCounter.value <= 0) {
    isDragOver.value = false;
    dragCounter.value = 0;
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  dragCounter.value = 0;

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const fileArray = Array.from(files);

    // Validate files before adding
    const validFiles = fileArray.filter((file) => {
      const validExtensions = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.pptx', '.md', '.rtf'];
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidSize = file.size <= maxFileSize;
      const isValidType = validExtensions.includes(extension);

      if (!isValidType || !isValidSize) {
        onRejected([
          {
            file,
            failedPropValidation: !isValidType ? 'accept' : 'max-file-size',
          },
        ]);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      addFiles(validFiles);
    }
  }
};

interface RejectedEntry {
  failedPropValidation: string;
  file: File;
}

const onRejected = (rejectedEntries: RejectedEntry[]) => {
  rejectedEntries.forEach((entry) => {
    let message = '';
    let icon = 'error';

    if (entry.failedPropValidation === 'max-file-size') {
      message = `File "${entry.file.name}" is too large. Maximum size is ${maxFileSize / 1024 / 1024}MB.`;
      icon = 'warning';
    } else if (entry.failedPropValidation === 'accept') {
      message = `File "${entry.file.name}" has an unsupported format.`;
      icon = 'block';
    } else {
      message = `File "${entry.file.name}" was rejected.`;
    }

    $q.notify({
      type: 'negative',
      message,
      icon,
      position: 'bottom',
      timeout: 3000,
    });
  });
};

const addFiles = (newFiles: File[]) => {
  // Filter out duplicates
  const existingNames = selectedFiles.value.map((f) => f.name);
  const uniqueFiles = newFiles.filter((file) => !existingNames.includes(file.name));

  if (uniqueFiles.length !== newFiles.length) {
    $q.notify({
      type: 'warning',
      message: 'Some files were already selected.',
      position: 'bottom',
      timeout: 2000,
    });
  }

  if (uniqueFiles.length > 0) {
    selectedFiles.value = [...selectedFiles.value, ...uniqueFiles];

    $q.notify({
      type: 'positive',
      message: `Added ${uniqueFiles.length} file(s).`,
      icon: 'check_circle',
      position: 'bottom',
      timeout: 2000,
    });
  }

  fileModel.value = null;
};

const removeFile = (index: number) => {
  const removedFile = selectedFiles.value.splice(index, 1)[0];
  $q.notify({
    type: 'info',
    message: `Removed "${removedFile.name}"`,
    position: 'bottom',
    timeout: 2000,
  });
};

const clearAllFiles = () => {
  $q.dialog({
    title: 'Clear All Files',
    message: 'Remove all selected files?',
    persistent: true,
    ok: {
      color: 'negative',
      label: 'Clear All',
    },
    cancel: {
      flat: true,
    },
  }).onOk(() => {
    selectedFiles.value = [];
    fileModel.value = null;
    $q.notify({
      type: 'info',
      message: 'All files cleared',
      position: 'bottom',
      timeout: 2000,
    });
  });
};

const uploadFiles = async () => {
  // If no new files selected and we have uploaded files, reuse existing ones
  if (selectedFiles.value.length === 0 && hasUploadedFiles.value) {
    $q.notify({
      type: 'info',
      message: 'Using previously uploaded files',
      icon: 'info',
      position: 'bottom',
      timeout: 2000,
    });

    // Emit existing files without re-uploading
    emit('upload-success', {
      sessionId: props.sessionId!,
      files: props.uploadedFiles,
    });
    return;
  }

  // If new files match uploaded files exactly, reuse existing upload
  if (filesMatchUploaded.value && props.sessionId) {
    $q.notify({
      type: 'info',
      message: 'Files unchanged, using existing upload',
      icon: 'check_circle',
      position: 'bottom',
      timeout: 2000,
    });

    emit('upload-success', {
      sessionId: props.sessionId,
      files: props.uploadedFiles,
    });

    selectedFiles.value = [];
    fileModel.value = null;
    return;
  }

  // Files have changed or new upload - upload all files
  if (selectedFiles.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Please select files to upload',
      position: 'bottom',
      timeout: 2000,
    });
    return;
  }

  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    selectedFiles.value.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/api/wizard/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = progressEvent.loaded / progressEvent.total;
        }
      },
    });

    if (response.data.success) {
      emit('upload-success', {
        sessionId: response.data.data.sessionId,
        files: response.data.data.files,
      });

      selectedFiles.value = [];
      fileModel.value = null;

      $q.notify({
        type: 'positive',
        message: 'Files uploaded successfully!',
        icon: 'check_circle',
        position: 'bottom',
        timeout: 3000,
      });
    } else {
      throw new Error(response.data.error || 'Upload failed');
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
    emit('upload-failed', errorMessage);

    $q.notify({
      type: 'negative',
      message: errorMessage,
      icon: 'error',
      position: 'bottom',
      timeout: 4000,
    });
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
  }
};

// Utility methods
const getFileIcon = (filename: string): string => {
  const extension = getFileExtension(filename);
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    docx: 'description',
    doc: 'description',
    txt: 'text_snippet',
    csv: 'table_chart',
    xlsx: 'table_chart',
    xls: 'table_chart',
    pptx: 'slideshow',
    md: 'article',
    rtf: 'description',
  };
  return iconMap[extension] || 'insert_drive_file';
};

const getFileColor = (filename: string): string => {
  const extension = getFileExtension(filename);
  const colorMap: Record<string, string> = {
    pdf: 'red-6',
    docx: 'blue-6',
    doc: 'blue-6',
    txt: 'grey-6',
    csv: 'green-6',
    xlsx: 'green-6',
    xls: 'green-6',
    pptx: 'orange-6',
    md: 'purple-6',
    rtf: 'blue-6',
  };
  return colorMap[extension] || 'grey-6';
};

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Expose methods for parent component
const hasFiles = computed(() => selectedFiles.value.length > 0);

defineExpose({
  uploadFiles,
  hasFiles,
  selectedFiles,
});
</script>

<style lang="scss" scoped>
.file-upload-container {
  width: 100%;
}

.upload-zone {
  border: 2px dashed #cbd5e0;
  border-radius: 6px;
  padding: 1.25rem 1rem;
  text-align: center;
  transition: all 0.3s ease;
  background: #fafafa;
  cursor: pointer;

  &:hover {
    border-color: #3b82f6;
    background: #f7fafc;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }

  &.drag-over {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: scale(1.01);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);

    .upload-icon {
      transform: scale(1.1);
    }

    .upload-title {
      color: #3b82f6;
      font-weight: 600;
    }
  }
}

.upload-content {
  pointer-events: none;
}

.upload-icon {
  transition: all 0.3s ease;

  &.bounce {
    animation: bounce 0.6s ease;
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px);
  }
  60% {
    transform: translateY(-4px);
  }
}

.upload-button {
  pointer-events: auto;
}

.upload-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.upload-subtitle {
  font-size: 0.75rem;
}

.upload-hint {
  font-size: 0.7rem;
}

.selected-files {
  .files-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0;

    h6 {
      font-size: 0.95rem;
    }
  }
}

.files-list {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;

  &.uploaded-list {
    border-color: #86efac;
    background-color: #f0fdf4;
  }
}

.file-item {
  padding: 0.5rem 0.75rem;
  min-height: auto;

  &:hover {
    background-color: #f9fafb;

    .remove-btn {
      opacity: 1;
    }
  }
}

.file-name {
  font-size: 0.875rem;
}

.file-details {
  font-size: 0.75rem;
}

.remove-btn {
  opacity: 0.6;

  &:hover {
    color: #dc2626;
    background-color: rgba(220, 38, 38, 0.1);
  }
}

.upload-action {
  .upload-submit-btn {
    min-width: 200px;
  }
}

.upload-progress {
  .progress-text {
    font-size: 0.8rem;
  }
}

// Responsive design
@media (max-width: 600px) {
  .upload-zone {
    padding: 1rem 0.75rem;
  }

  .upload-icon {
    font-size: 2rem !important;
  }

  .files-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
