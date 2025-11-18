<template>
  <div class="processing-options-step">
    <div class="q-mb-lg">
      <div class="text-subtitle1 q-mb-md">Select AI Models</div>
      <q-option-group
        v-model="modelsValue"
        :options="modelOptions"
        color="primary"
        type="checkbox"
      />
    </div>

    <div class="q-mb-lg">
      <div class="text-subtitle1 q-mb-md">Output Format</div>
      <q-option-group v-model="formatValue" :options="formatOptions" color="primary" type="radio" />
    </div>

    <div class="q-mb-lg">
      <q-input
        v-model="pathValue"
        label="Output Path"
        hint="Where to save the processed files"
        outlined
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  selectedModels: string[];
  outputFormat: string;
  outputPath: string;
  processingType: string;
}>();

const emit = defineEmits<{
  'update:selectedModels': [models: string[]];
  'update:outputFormat': [format: string];
  'update:outputPath': [path: string];
  'options-changed': [
    options: { selectedModels: string[]; outputFormat: string; outputPath: string },
  ];
}>();

const modelOptions = [
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'Claude 3', value: 'claude-3' },
  { label: 'Llama 3.1', value: 'llama3.1' },
  { label: 'Mistral', value: 'mistral' },
];

const formatOptions = [
  { label: 'PDF', value: 'pdf' },
  { label: 'DOCX', value: 'docx' },
  { label: 'TXT', value: 'txt' },
];

const modelsValue = computed({
  get: () => props.selectedModels,
  set: (value: string[]) => {
    emit('update:selectedModels', value);
    emitOptionsChanged();
  },
});

const formatValue = computed({
  get: () => props.outputFormat,
  set: (value: string) => {
    emit('update:outputFormat', value);
    emitOptionsChanged();
  },
});

const pathValue = computed({
  get: () => props.outputPath,
  set: (value: string) => {
    emit('update:outputPath', value);
    emitOptionsChanged();
  },
});

const emitOptionsChanged = () => {
  emit('options-changed', {
    selectedModels: modelsValue.value,
    outputFormat: formatValue.value,
    outputPath: pathValue.value,
  });
};
</script>
