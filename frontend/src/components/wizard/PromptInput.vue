<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 3: Set AI Prompt</div>
      <div class="text-caption text-grey">
        Tell the AI what you want to do with your document(s). Be as specific as possible for better results.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Quick Templates</div>
      <div class="row q-col-gutter-sm">
        <div v-for="template in templates" :key="template.id" class="col-12 col-sm-6 col-md-3">
          <q-btn
            :outline="selectedTemplate !== template.id"
            :color="selectedTemplate === template.id ? 'primary' : 'grey'"
            class="full-width"
            no-caps
            stack
            @click="selectTemplate(template.id)"
          >
            <q-icon :name="template.icon" size="sm" class="q-mb-xs" />
            <div class="text-weight-medium">{{ template.name }}</div>
            <div class="text-caption">{{ template.description }}</div>
          </q-btn>
        </div>
      </div>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Your Instructions</div>
      <q-input
        v-model="localPrompt"
        type="textarea"
        outlined
        :rows="6"
        placeholder="Example: Summarize the main points of this report and extract all financial figures into a table."
        :rules="[(val: string) => !!val.trim() || 'Please enter your instructions']"
        @update:model-value="onPromptChange"
      >
        <template #counter>
          {{ localPrompt.length }} characters
        </template>
      </q-input>
    </q-card-section>

    <q-card-section v-if="files.length > 0">
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="folder" class="q-mr-xs" />
        Processing Files ({{ files.length }})
      </div>
      <q-chip
        v-for="file in files"
        :key="file.id"
        :icon="getFileIcon(file.mimeType)"
        :color="getFileColor(file.mimeType)"
        text-color="white"
        class="q-mr-xs q-mb-xs"
      >
        {{ file.filename }}
      </q-chip>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { UploadedFile } from 'src/types/file.types';
import type { PromptTemplate } from 'src/types/wizard.types';

const props = defineProps<{
  modelValue: string;
  selectedTemplate: string | null;
  files: UploadedFile[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:selectedTemplate', value: string): void;
}>();

const localPrompt = ref(props.modelValue);

const templates: PromptTemplate[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Create concise summary',
    icon: 'summarize',
    prompt: 'Summarize the main points of this document, highlighting key findings and conclusions.'
  },
  {
    id: 'extract',
    name: 'Extract Data',
    description: 'Pull structured data',
    icon: 'table_chart',
    prompt: 'Extract all structured data from this document into organized tables.'
  },
  {
    id: 'format',
    name: 'Format & Clean',
    description: 'Improve formatting',
    icon: 'format_paint',
    prompt: 'Improve the document formatting and organization for better readability.'
  },
  {
    id: 'questions',
    name: 'Generate Questions',
    description: 'Create follow-up questions',
    icon: 'quiz',
    prompt: 'Generate follow-up questions based on the content of this document.'
  }
];

watch(() => props.modelValue, (newVal) => {
  localPrompt.value = newVal;
});

function selectTemplate(templateId: string) {
  const template = templates.find(t => t.id === templateId);
  if (template) {
    localPrompt.value = template.prompt;
    emit('update:selectedTemplate', templateId);
    emit('update:modelValue', template.prompt);
  }
}

function onPromptChange(value: string | number | null) {
  emit('update:modelValue', String(value || ''));
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'picture_as_pdf';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'description';
  if (mimeType.includes('excel') || mimeType.includes('xlsx')) return 'table_chart';
  if (mimeType.includes('csv')) return 'grid_on';
  return 'insert_drive_file';
}

function getFileColor(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'red';
  if (mimeType.includes('word') || mimeType.includes('docx')) return 'blue';
  if (mimeType.includes('excel') || mimeType.includes('xlsx')) return 'green';
  if (mimeType.includes('csv')) return 'orange';
  return 'grey';
}
</script>
