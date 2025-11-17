<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 1: Upload Files</div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-uploader
        ref="uploaderRef"
        :url="uploadUrl"
        label="Upload your documents"
        multiple
        batch
        :accept="acceptedTypes"
        :max-file-size="maxFileSize"
        :max-total-size="maxTotalSize"
        flat
        bordered
        class="full-width"
        field-name="files"
        @added="onFilesAdded"
        @removed="onFileRemoved"
        @uploaded="onUploaded"
        @failed="onUploadFailed"
      >
        <template #header="scope">
          <div class="row no-wrap items-center q-pa-sm q-gutter-xs">
            <q-btn
              v-if="scope.queuedFiles.length > 0"
              icon="clear_all"
              round
              dense
              flat
              @click="scope.removeQueuedFiles"
            >
              <q-tooltip>Clear All</q-tooltip>
            </q-btn>
            <q-btn
              v-if="scope.uploadedFiles.length > 0"
              icon="done_all"
              round
              dense
              flat
              @click="scope.removeUploadedFiles"
            >
              <q-tooltip>Remove Uploaded Files</q-tooltip>
            </q-btn>
            <q-spinner v-if="scope.isUploading" class="q-uploader__spinner" />
            <div class="col">
              <div class="q-uploader__title">Upload Documents</div>
              <div class="q-uploader__subtitle">
                {{ scope.uploadSizeLabel }} / {{ scope.uploadProgressLabel }}
              </div>
            </div>
            <q-btn
              v-if="scope.canAddFiles"
              type="a"
              icon="add_box"
              round
              dense
              flat
              @click="scope.pickFiles"
            >
              <q-uploader-add-trigger />
              <q-tooltip>Pick Files</q-tooltip>
            </q-btn>
            <q-btn
              v-if="scope.canUpload"
              icon="cloud_upload"
              round
              dense
              flat
              @click="scope.upload"
            >
              <q-tooltip>Upload Files</q-tooltip>
            </q-btn>

            <q-btn
              v-if="scope.isUploading"
              icon="clear"
              round
              dense
              flat
              @click="scope.abort"
            >
              <q-tooltip>Abort Upload</q-tooltip>
            </q-btn>
          </div>
        </template>

        <template #list="scope">
          <q-list separator>
            <q-item v-for="file in scope.files" :key="file.__key">
              <q-item-section avatar>
                <q-icon :name="getFileIcon(file.type)" :color="getFileColor(file.type)" size="md" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="full-width ellipsis">
                  {{ file.name }}
                </q-item-label>
                <q-item-label caption>
                  {{ formatFileSize(file.size) }} - {{ file.type || 'Unknown type' }}
                </q-item-label>
              </q-item-section>

              <q-item-section
                v-if="file.__status === 'failed'"
                side
              >
                <q-badge color="negative" label="Failed" />
              </q-item-section>

              <q-item-section
                v-else-if="file.__status === 'uploaded'"
                side
              >
                <q-icon name="done" color="positive" size="sm" />
              </q-item-section>

              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  @click="scope.removeFile(file)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-uploader>
    </q-card-section>

    <q-card-section v-if="uploadedFiles.length > 0">
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="check_circle" color="positive" class="q-mr-xs" />
        Successfully Uploaded ({{ uploadedFiles.length }})
      </div>
      <q-list bordered separator>
        <q-item v-for="file in uploadedFiles" :key="file.id">
          <q-item-section avatar>
            <q-icon :name="getFileIcon(file.mimeType)" :color="getFileColor(file.mimeType)" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ file.filename }}</q-item-label>
            <q-item-label caption>
              {{ formatFileSize(file.size) }}
              <q-badge v-if="file.tokenCount" color="info" class="q-ml-sm">
                {{ file.tokenCount }} tokens
              </q-badge>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              round
              icon="close"
              color="negative"
              @click="removeUploadedFile(file.id)"
            />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-card-section v-if="uploadedFiles.length > 0">
      <q-banner class="bg-info text-white">
        <template #avatar>
          <q-icon name="info" />
        </template>
        Total: {{ totalTokens }} tokens estimated
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { QUploader, useQuasar } from 'quasar';
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
const uploaderRef = ref<InstanceType<typeof QUploader> | null>(null);

const uploadUrl = computed(() => {
  const baseUrl = process.env.API_URL || 'http://localhost:3000/api/wizard';
  return `${baseUrl}/upload`;
});

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

function onFilesAdded(files: readonly { name: string }[]) {
  $q.notify({
    type: 'info',
    message: `Added ${files.length} file(s) to queue`,
    position: 'top'
  });
}

function onFileRemoved() {
  // File removed from queue
}

function onUploaded(info: { xhr: XMLHttpRequest }) {
  try {
    const response = JSON.parse(info.xhr.responseText);
    if (response.success) {
      emit('upload-success', {
        sessionId: response.data.sessionId,
        files: response.data.files
      });
      $q.notify({
        type: 'positive',
        message: 'Files uploaded successfully!',
        position: 'top'
      });
    } else {
      emit('upload-failed', response.error || 'Upload failed');
      $q.notify({
        type: 'negative',
        message: response.error || 'Upload failed',
        position: 'top'
      });
    }
  } catch {
    emit('upload-failed', 'Invalid server response');
    $q.notify({
      type: 'negative',
      message: 'Invalid server response',
      position: 'top'
    });
  }
}

function onUploadFailed(info: { xhr: XMLHttpRequest }) {
  const errorMsg = info.xhr.statusText || 'Upload failed';
  emit('upload-failed', errorMsg);
  $q.notify({
    type: 'negative',
    message: `Upload failed: ${errorMsg}`,
    position: 'top'
  });
}

function removeUploadedFile(fileId: string) {
  emit('remove-file', fileId);
}
</script>
