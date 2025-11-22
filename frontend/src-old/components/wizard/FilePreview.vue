<template>
  <div class="file-preview-panel">
    <!-- Files List -->
    <div class="files-sidebar">
      <div class="text-subtitle2 q-mb-sm text-grey-8">Uploaded Files ({{ files.length }})</div>
      <q-list bordered separator class="rounded-borders">
        <q-item
          v-for="(file, index) in files"
          :key="file.id"
          clickable
          :active="selectedFileIndex === index"
          @click="selectFile(index)"
          class="file-item"
        >
          <q-item-section avatar>
            <q-icon
              :name="getFileIcon(file.filename)"
              :color="selectedFileIndex === index ? 'primary' : 'grey-6'"
              size="md"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ file.filename }}</q-item-label>
            <q-item-label caption>
              {{ formatFileSize(file.size) }} • {{ file.tokenCount }} tokens
            </q-item-label>
          </q-item-section>
          <q-item-section side v-if="selectedFileIndex === index">
            <q-icon name="chevron_right" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- File Preview/Info -->
    <div class="file-preview-content">
      <div v-if="selectedFile" class="preview-container">
        <!-- File Header -->
        <div class="preview-header q-pa-md bg-grey-1">
          <div class="row items-center">
            <q-icon
              :name="getFileIcon(selectedFile.filename)"
              color="primary"
              size="lg"
              class="q-mr-md"
            />
            <div class="col">
              <div class="text-h6">{{ selectedFile.filename }}</div>
              <div class="text-caption text-grey-6">
                {{ selectedFile.mimeType }} • {{ formatFileSize(selectedFile.size) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Switcher -->
        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey-7"
          active-color="primary"
          indicator-color="primary"
          align="left"
        >
          <q-tab name="info" label="File Info" icon="info" />
          <q-tab name="preview" label="Document Preview" icon="visibility" />
        </q-tabs>

        <q-separator />

        <!-- Tab Panels -->
        <q-tab-panels v-model="activeTab" animated class="file-content-panels">
          <!-- Info Panel -->
          <q-tab-panel name="info">
            <!-- File Metadata -->
            <div class="row q-col-gutter-md q-mb-md">
              <div class="col-6">
                <q-card flat bordered>
                  <q-card-section class="text-center">
                    <div class="text-h6 text-primary">{{ selectedFile.tokenCount }}</div>
                    <div class="text-caption text-grey-6">Estimated Tokens</div>
                  </q-card-section>
                </q-card>
              </div>
              <div class="col-6">
                <q-card flat bordered>
                  <q-card-section class="text-center">
                    <div class="text-h6 text-primary">{{ selectedFile.sections?.length || 0 }}</div>
                    <div class="text-caption text-grey-6">Sections Detected</div>
                  </q-card-section>
                </q-card>
              </div>
            </div>

            <!-- Sections -->
            <div
              v-if="selectedFile.sections && selectedFile.sections.length > 0"
              class="sections-list q-mt-md"
            >
              <div class="text-subtitle2 q-mb-sm text-grey-8">Document Sections</div>
              <q-list bordered separator class="rounded-borders">
                <q-item v-for="(section, idx) in selectedFile.sections" :key="idx">
                  <q-item-section avatar>
                    <q-chip size="sm" color="blue-1" text-color="blue-9">
                      H{{ section.level }}
                    </q-chip>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ section.title }}</q-item-label>
                    <q-item-label caption>
                      Lines {{ section.startLine }} - {{ section.endLine }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <!-- Tables -->
            <div
              v-if="selectedFile.tables && selectedFile.tables.length > 0"
              class="tables-list q-mt-md"
            >
              <div class="text-subtitle2 q-mb-sm text-grey-8">
                Tables Found ({{ selectedFile.tables.length }})
              </div>
              <q-list bordered separator class="rounded-borders">
                <q-item v-for="(table, idx) in selectedFile.tables" :key="idx">
                  <q-item-section avatar>
                    <q-icon name="table_chart" color="green" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>Table #{{ idx + 1 }}</q-item-label>
                    <q-item-label caption>
                      {{ table.headers.length }} columns • {{ table.rows.length }} rows • Lines
                      {{ table.startLine }} - {{ table.endLine }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <!-- PDF Viewer Note -->
            <div v-if="isPDF(selectedFile.filename)" class="pdf-note q-mt-md">
              <q-banner class="bg-blue-1 rounded-borders">
                <template #avatar>
                  <q-icon name="picture_as_pdf" color="blue" />
                </template>
                <div class="text-body2">
                  <strong>PDF Preview:</strong> Use the sections and line numbers above to target
                  specific parts of the document in your prompts.
                </div>
              </q-banner>
            </div>
          </q-tab-panel>

          <!-- Preview Panel -->
          <q-tab-panel name="preview" class="preview-panel">
            <DocumentViewer
              :file="localFiles[selectedFileIndex]"
              :filename="selectedFile.filename"
              :mime-type="selectedFile.mimeType"
            />
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <!-- No File Selected -->
      <div v-else class="no-selection q-pa-xl text-center">
        <q-icon name="description" size="4rem" color="grey-4" class="q-mb-md" />
        <p class="text-grey-6">Select a file from the list to view its details</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FileMetadata } from 'src/types/api.types';
import DocumentViewer from './DocumentViewer.vue';

const props = defineProps<{
  files: FileMetadata[];
  localFiles?: File[];
}>();

const selectedFileIndex = ref(0);
const activeTab = ref('info');

const selectedFile = computed(() => {
  if (props.files.length === 0) return null;
  return props.files[selectedFileIndex.value] || null;
});

function selectFile(index: number) {
  selectedFileIndex.value = index;
}

function getFileIcon(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    docx: 'description',
    doc: 'description',
    txt: 'text_snippet',
    csv: 'table_chart',
    xlsx: 'table_chart',
    xls: 'table_chart',
  };
  return iconMap[extension || ''] || 'insert_drive_file';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isPDF(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}
</script>

<style lang="scss" scoped>
.file-preview-panel {
  display: flex;
  gap: 1rem;
  min-height: 400px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.files-sidebar {
  flex: 0 0 300px;

  @media (max-width: 768px) {
    flex: 1;
  }
}

.file-preview-content {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.file-item {
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(25, 118, 210, 0.05);
  }

  &.q-item--active {
    background-color: rgba(25, 118, 210, 0.1);
  }
}

.preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-header {
  border-bottom: 1px solid #e0e0e0;
}

.file-metadata {
  flex: 1;
  overflow-y: auto;
}

.file-content-panels {
  flex: 1;
  background: white;
  overflow: hidden;

  :deep(.q-tab-panel) {
    padding: 0;
    height: 100%;
    overflow-y: auto;
  }
}

.preview-panel {
  height: 100%;
  padding: 0 !important;

  :deep(.document-viewer) {
    height: 100%;
    min-height: 500px;
  }
}

.no-selection {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
