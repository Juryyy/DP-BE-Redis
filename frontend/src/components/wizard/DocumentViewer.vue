<template>
  <div class="document-viewer">
    <!-- Loading State -->
    <div v-if="isLoading" class="viewer-loading">
      <q-spinner-dots color="primary" size="3rem" />
      <p class="text-grey-6 q-mt-md">Loading document...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="viewer-error q-pa-lg text-center">
      <q-icon name="error" color="negative" size="3rem" class="q-mb-md" />
      <p class="text-negative">{{ error }}</p>
      <q-btn flat color="primary" label="Retry" icon="refresh" @click="loadDocument" />
    </div>

    <!-- Document Viewer -->
    <div v-else class="viewer-content">
      <!-- PDF Viewer -->
      <div v-if="fileType === 'pdf'" class="pdf-viewer">
        <div v-if="!compact" class="viewer-toolbar q-pa-sm bg-grey-2 row items-center justify-between">
          <div class="row items-center q-gutter-sm">
            <q-btn
              flat
              dense
              icon="zoom_in"
              @click="zoomIn"
              :disable="scale >= 4"
              size="sm"
            >
              <q-tooltip>Zoom In (Ctrl +)</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              icon="zoom_out"
              @click="zoomOut"
              :disable="scale <= 0.3"
              size="sm"
            >
              <q-tooltip>Zoom Out (Ctrl -)</q-tooltip>
            </q-btn>
            <q-btn flat dense icon="refresh" @click="resetZoom" size="sm">
              <q-tooltip>Reset Zoom (Ctrl 0)</q-tooltip>
            </q-btn>
            <q-select
              v-model="scale"
              :options="zoomOptions"
              dense
              outlined
              emit-value
              map-options
              style="width: 100px"
              class="zoom-select"
            />
          </div>
          <div v-if="pdfNumPages" class="text-caption text-grey-7">
            Page {{ currentPage }} of {{ pdfNumPages }}
          </div>
        </div>

        <div class="pdf-container" ref="pdfContainerRef" @wheel="onWheel">
          <div class="pdf-scroll-wrapper">
            <VuePdfEmbed
              v-if="documentUrl"
              :source="documentUrl"
              :page="currentPage"
              :width="pdfWidth"
              @loaded="onPdfLoaded"
              @rendering-failed="onPdfError"
              class="pdf-page"
            />
          </div>

          <div v-if="!compact && pdfNumPages && pdfNumPages > 1" class="pdf-pagination q-mt-md text-center">
            <q-btn
              flat
              icon="chevron_left"
              @click="prevPage"
              :disable="currentPage <= 1"
              label="Previous"
              size="sm"
            />
            <q-input
              v-model.number="currentPage"
              type="number"
              dense
              outlined
              :min="1"
              :max="pdfNumPages"
              class="page-input q-mx-md"
              style="width: 80px; display: inline-block"
            />
            <q-btn
              flat
              icon-right="chevron_right"
              @click="nextPage"
              :disable="currentPage >= pdfNumPages"
              label="Next"
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- Excel Viewer -->
      <div v-else-if="fileType === 'excel'" class="excel-viewer">
        <div class="viewer-toolbar q-pa-sm bg-grey-2">
          <div class="text-subtitle2 text-grey-8">Excel Spreadsheet</div>
        </div>
        <div class="excel-container" ref="excelContainerRef">
          <VueOfficeExcel
            v-if="documentUrl"
            :src="documentUrl"
            @rendered="onExcelRendered"
            @error="onExcelError"
          />
        </div>
      </div>

      <!-- Word Viewer -->
      <div v-else-if="fileType === 'word'" class="word-viewer">
        <div class="viewer-toolbar q-pa-sm bg-grey-2 row items-center justify-between">
          <div class="text-subtitle2 text-grey-8">Word Document</div>
          <div class="row items-center q-gutter-sm">
            <q-btn
              flat
              dense
              icon="zoom_in"
              @click="zoomIn"
              :disable="scale >= 2"
              size="sm"
            >
              <q-tooltip>Zoom In</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              icon="zoom_out"
              @click="zoomOut"
              :disable="scale <= 0.5"
              size="sm"
            >
              <q-tooltip>Zoom Out</q-tooltip>
            </q-btn>
            <q-chip size="sm" color="grey-3">{{ Math.round(scale * 100) }}%</q-chip>
          </div>
        </div>
        <div class="word-container" ref="wordContainerRef" :style="{ transform: `scale(${scale})`, transformOrigin: 'top left' }">
          <VueOfficeDocx
            v-if="documentUrl"
            :src="documentUrl"
            @rendered="onWordRendered"
            @error="onWordError"
          />
        </div>
      </div>

      <!-- TXT Viewer -->
      <div v-else-if="fileType === 'txt'" class="txt-viewer">
        <div class="viewer-toolbar q-pa-sm bg-grey-2">
          <div class="text-subtitle2 text-grey-8">Text File</div>
        </div>
        <div class="txt-container q-pa-md">
          <pre class="txt-content">{{ textContent }}</pre>
        </div>
      </div>

      <!-- Unsupported File Type -->
      <div v-else class="unsupported-viewer q-pa-lg text-center">
        <q-icon name="insert_drive_file" color="grey-5" size="4rem" class="q-mb-md" />
        <p class="text-grey-6">
          Preview not available for this file type.
        </p>
        <p class="text-caption text-grey-5">
          Supported formats: PDF, DOCX, DOC, XLSX, XLS, TXT
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import VuePdfEmbed from 'vue-pdf-embed';
import VueOfficeDocx from '@vue-office/docx';
import VueOfficeExcel from '@vue-office/excel';
import '@vue-office/docx/lib/index.css';
import '@vue-office/excel/lib/index.css';

const props = defineProps<{
  file?: File;
  fileUrl?: string;
  filename: string;
  mimeType?: string;
  compact?: boolean; // Compact mode for embedded use
  page?: number; // External page control
}>();

const emit = defineEmits<{
  'pdf-loaded': [data: { numPages: number }];
  'page-changed': [page: number];
}>();

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const documentUrl = ref<string | null>(null);
const textContent = ref<string>('');

// PDF state
const pdfNumPages = ref<number>(0);
const currentPage = ref(1);
const scale = ref(1);
const baseWidth = ref(800); // Base PDF width

// Refs
const pdfContainerRef = ref<HTMLElement>();
const excelContainerRef = ref<HTMLElement>();
const wordContainerRef = ref<HTMLElement>();

// Zoom options
const zoomOptions = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '175%', value: 1.75 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
  { label: '400%', value: 4 },
];

// Computed
const fileType = computed(() => {
  const extension = props.filename.split('.').pop()?.toLowerCase();
  const mime = props.mimeType?.toLowerCase();

  if (extension === 'pdf' || mime?.includes('pdf')) {
    return 'pdf';
  }

  if (
    extension === 'xlsx' ||
    extension === 'xls' ||
    mime?.includes('spreadsheet') ||
    mime?.includes('excel')
  ) {
    return 'excel';
  }

  if (
    extension === 'docx' ||
    extension === 'doc' ||
    mime?.includes('wordprocessing') ||
    mime?.includes('msword')
  ) {
    return 'word';
  }

  if (extension === 'txt' || mime?.includes('text/plain')) {
    return 'txt';
  }

  return 'unsupported';
});

const pdfWidth = computed(() => {
  return baseWidth.value * scale.value;
});

// Methods
async function loadDocument() {
  try {
    isLoading.value = true;
    error.value = null;

    if (props.fileUrl) {
      // Use provided URL
      documentUrl.value = props.fileUrl;
    } else if (props.file) {
      // Create object URL from File
      if (fileType.value === 'txt') {
        // Read text file content
        const text = await props.file.text();
        textContent.value = text;
      } else {
        documentUrl.value = URL.createObjectURL(props.file);
      }
    } else {
      throw new Error('No file or URL provided');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load document';
    console.error('Document load error:', err);
  } finally {
    isLoading.value = false;
  }
}

function zoomIn() {
  const currentIndex = zoomOptions.findIndex(opt => opt.value === scale.value);
  if (currentIndex < zoomOptions.length - 1) {
    scale.value = zoomOptions[currentIndex + 1].value;
  } else if (scale.value < 4) {
    scale.value = Math.min(scale.value + 0.5, 4);
  }
}

function zoomOut() {
  const currentIndex = zoomOptions.findIndex(opt => opt.value === scale.value);
  if (currentIndex > 0) {
    scale.value = zoomOptions[currentIndex - 1].value;
  } else if (scale.value > 0.3) {
    scale.value = Math.max(scale.value - 0.25, 0.3);
  }
}

function resetZoom() {
  scale.value = 1;
}

function onWheel(event: WheelEvent) {
  // Ctrl+Scroll to zoom
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();

    if (event.deltaY < 0) {
      // Scroll up = zoom in
      zoomIn();
    } else {
      // Scroll down = zoom out
      zoomOut();
    }
  }
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

function onPdfLoaded(pdf: { numPages: number }) {
  pdfNumPages.value = pdf.numPages;
  emit('pdf-loaded', { numPages: pdf.numPages });
}

function onPdfError(err: Error) {
  error.value = `Failed to load PDF: ${err.message}`;
  console.error('PDF error:', err);
}

function onExcelRendered() {
  console.log('Excel rendered successfully');
}

function onExcelError(err: Error) {
  error.value = `Failed to load Excel file: ${err.message}`;
  console.error('Excel error:', err);
}

function onWordRendered() {
  console.log('Word document rendered successfully');
}

function onWordError(err: Error) {
  error.value = `Failed to load Word document: ${err.message}`;
  console.error('Word error:', err);
}

// Watch for prop changes
watch([() => props.file, () => props.fileUrl], () => {
  loadDocument();
}, { immediate: false });

// Watch page prop and sync with internal state
watch(() => props.page, (newPage) => {
  if (newPage !== undefined && newPage !== currentPage.value) {
    currentPage.value = newPage;
  }
});

// Watch page changes and emit
watch(currentPage, (newPage) => {
  emit('page-changed', newPage);
});

// Lifecycle
onMounted(() => {
  loadDocument();
});

// Cleanup
onMounted(() => {
  return () => {
    // Revoke object URL on cleanup
    if (documentUrl.value && documentUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(documentUrl.value);
    }
  };
});
</script>

<style lang="scss" scoped>
.document-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
}

.viewer-loading,
.viewer-error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.viewer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-toolbar {
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;

  .zoom-select {
    :deep(.q-field__control) {
      min-height: 32px;
      height: 32px;
    }
  }
}

// PDF Viewer
.pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.pdf-container {
  flex: 1;
  overflow: auto;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.pdf-scroll-wrapper {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.pdf-page {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  background: white;
  margin-bottom: 1rem;
  user-select: text;
  cursor: text;

  canvas {
    display: block;
  }
}

.pdf-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

// Excel Viewer
.excel-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.excel-container {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  background: white;

  :deep(.vue-office-excel) {
    width: 100%;
    height: 100%;
  }
}

// Word Viewer
.word-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.word-container {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  background: white;
  transition: transform 0.2s ease;

  :deep(.vue-office-docx) {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// Text Viewer
.txt-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.txt-container {
  flex: 1;
  overflow: auto;
  background: white;
}

.txt-content {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

// Unsupported
.unsupported-viewer {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

// Responsive
@media (max-width: 768px) {
  .pdf-container,
  .excel-container,
  .word-container,
  .txt-container {
    padding: 0.5rem;
  }

  .viewer-toolbar {
    flex-wrap: wrap;
  }
}
</style>
