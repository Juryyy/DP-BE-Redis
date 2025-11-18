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

    <!-- Custom Upload Zone (Your Figma Design) -->
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
          size="4rem"
          :color="isDragOver ? 'primary' : 'grey-5'"
          class="q-mb-md upload-icon"
          :class="{ bounce: isDragOver }"
        />
        <h6 class="text-grey-7 q-ma-none q-mb-sm upload-title">
          {{ isDragOver ? 'Drop your files here' : 'Drag and drop your files here' }}
        </h6>
        <p class="text-grey-5 q-ma-none q-mb-lg upload-subtitle">or</p>
        <q-btn
          color="primary"
          label="Browse Files"
          icon="folder_open"
          @click.stop="triggerFileInput"
          unelevated
          class="upload-button"
        />
        <p class="text-grey-5 q-mt-md q-ma-none upload-hint">
          Supports PDF, DOCX, TXT, CSV, XLSX, PPTX, MD, RTF (Max {{ maxFileSize / 1024 / 1024 }}MB)
        </p>
      </div>
    </div>

    <!-- Selected Files List (Your Design) -->
    <div v-if="selectedFiles.length > 0" class="selected-files q-mt-lg">
      <div class="files-header q-mb-md">
        <h6 class="text-grey-8 q-ma-none">Selected Files ({{ selectedFiles.length }})</h6>
        <q-btn
          flat
          dense
          icon="clear_all"
          color="grey-6"
          @click="clearAllFiles"
          size="sm"
          label="Clear All"
        />
      </div>

      <q-list bordered separator class="rounded-borders files-list">
        <q-item v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <q-item-section avatar>
            <q-icon
              :name="getFileIcon(file.name)"
              :color="getFileColor(file.name)"
              size="md"
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
              size="sm"
              @click="removeFile(index)"
              class="remove-btn"
            >
              <q-tooltip>Remove file</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Processing Type Indicator -->
      <div class="processing-type-indicator q-mt-md">
        <q-chip
          :color="selectedFiles.length > 1 ? 'orange' : 'blue'"
          text-color="white"
          :icon="selectedFiles.length > 1 ? 'layers' : 'description'"
          class="processing-chip"
        >
          {{
            selectedFiles.length > 1
              ? 'Multiple Documents Processing'
              : 'Single Document Processing'
          }}
        </q-chip>
      </div>
    </div>

    <!-- Info Banner -->
    <div v-if="selectedFiles.length > 0" class="info-banner q-mt-md">
      <q-banner class="bg-blue-1 rounded-borders">
        <template #avatar>
          <q-icon name="info" color="blue" />
        </template>
        <div class="text-body2">
          Files are ready to upload. Click <strong>"Upload & Continue"</strong> button to proceed.
        </div>
      </q-banner>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';

// Props & Emits
const props = defineProps<{
  files: File[];
}>();

const emit = defineEmits<{
  'update:files': [files: File[]];
  'files-changed': [files: File[]];
}>();

// Quasar
const $q = useQuasar();

// Component state
const qFileRef = ref();
const fileModel = ref<File | File[] | null>(null);
const isDragOver = ref(false);
const dragCounter = ref(0);
const maxFileSize = 1024 * 1024 * 50;

const selectedFiles = computed({
  get: () => props.files,
  set: (value: File[]) => {
    emit('update:files', value);
    emit('files-changed', value);
  },
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
      message = `File "${entry.file.name}" has an unsupported format. Please use PDF, DOCX, TXT, CSV, XLSX, PPTX, MD, RTF files.`;
      icon = 'block';
    } else {
      message = `File "${entry.file.name}" was rejected.`;
    }

    $q.notify({
      type: 'negative',
      message,
      icon,
      position: 'bottom',
      timeout: 4000,
      actions: [{ icon: 'close', color: 'white', round: true }],
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
      message: 'Some files were already selected and have been skipped.',
      icon: 'info',
      position: 'bottom',
      timeout: 3000,
    });
  }

  if (uniqueFiles.length > 0) {
    // Just add files to local state - don't upload yet
    selectedFiles.value = [...selectedFiles.value, ...uniqueFiles];

    $q.notify({
      type: 'positive',
      message: `Added ${uniqueFiles.length} file(s). Click "Upload & Continue" to proceed.`,
      icon: 'check_circle',
      position: 'bottom',
      timeout: 3000,
    });
  }

  fileModel.value = null;
};

const removeFile = (index: number) => {
  const updatedFiles = [...selectedFiles.value];
  const removedFile = updatedFiles.splice(index, 1)[0];
  selectedFiles.value = updatedFiles;

  $q.notify({
    type: 'info',
    message: removedFile ? `Removed "${removedFile.name}"` : 'File removed',
    icon: 'delete',
    position: 'bottom',
    timeout: 2000,
  });
};

const clearAllFiles = () => {
  $q.dialog({
    title: 'Clear All Files',
    message: 'Are you sure you want to remove all selected files?',
    persistent: true,
    ok: {
      color: 'negative',
      label: 'Clear All',
    },
    cancel: {
      color: 'grey',
      flat: true,
    },
  }).onOk(() => {
    selectedFiles.value = [];
    fileModel.value = null;

    $q.notify({
      type: 'info',
      message: 'All files cleared',
      icon: 'clear_all',
      position: 'bottom',
      timeout: 2000,
    });
  });
};

// Utility methods
const getFileIcon = (filename: string): string => {
  const extension = getFileExtension(filename);
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    docx: 'description',
    txt: 'text_snippet',
    csv: 'table_chart',
  };
  return iconMap[extension] || 'insert_drive_file';
};

const getFileColor = (filename: string): string => {
  const extension = getFileExtension(filename);
  const colorMap: Record<string, string> = {
    pdf: 'red',
    docx: 'blue',
    txt: 'grey',
    csv: 'green',
  };
  return colorMap[extension] || 'grey';
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
</script>

<style lang="scss" scoped>
.file-upload-container {
  width: 100%;
}

.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  transition: all 0.3s ease;
  background: #fafafa;
  cursor: pointer;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: #1976d2;
    background: #f5f7fa;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
  }

  &.drag-over {
    border-color: #1976d2;
    background: #e3f2fd;
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(25, 118, 210, 0.25);

    .upload-icon {
      transform: scale(1.1);
    }

    .upload-title {
      color: #1976d2;
      font-weight: 600;
    }
  }
}

.upload-content {
  pointer-events: none;
  position: relative;
  z-index: 1;
}

.upload-icon {
  transition: all 0.3s ease;

  &.bounce {
    animation: bounce 0.6s ease;
  }
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

.upload-button {
  pointer-events: auto;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  }
}

.upload-title {
  transition: all 0.3s ease;
  font-size: 1.1rem;
}

.upload-subtitle {
  font-size: 0.9rem;
}

.upload-hint {
  font-size: 0.85rem;
}

.selected-files {
  .files-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
}

.files-list {
  border-radius: 8px;
  overflow: hidden;
}

.file-item {
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(25, 118, 210, 0.05);

    .remove-btn {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.file-icon {
  transition: transform 0.2s ease;
}

.file-name {
  font-size: 0.95rem;
}

.file-details {
  font-size: 0.8rem;
  color: #666;
}

.remove-btn {
  opacity: 0.7;
  transform: scale(0.9);
  transition: all 0.2s ease;

  &:hover {
    color: #f44336;
    background-color: rgba(244, 67, 54, 0.1);
  }
}

.processing-type-indicator {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.processing-chip {
  font-weight: 500;
  padding: 0.5rem 1rem;
}

.upload-progress {
  text-align: center;
}

.progress-bar {
  border-radius: 4px;
}

.progress-text {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

// Responsive design
@media (max-width: 600px) {
  .upload-zone {
    padding: 2rem 1rem;
  }

  .upload-icon {
    font-size: 3rem !important;
  }

  .upload-title {
    font-size: 1rem;
  }

  .files-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
