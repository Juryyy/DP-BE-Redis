<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 4: Processing Options</div>
      <div class="text-caption text-grey">
        Configure how you want your document to be processed and what format you prefer for the output.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-6">
          <div class="text-subtitle2 q-mb-sm">Processing Mode</div>
          <q-list bordered separator>
            <q-item
              v-for="mode in processingModes"
              :key="mode.value"
              tag="label"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-radio v-model="localMode" :val="mode.value" @update:model-value="onModeChange" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ mode.label }}</q-item-label>
                <q-item-label caption>{{ mode.description }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge v-if="mode.value === 'standard'" color="primary" label="Recommended" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div class="col-12 col-md-6">
          <div class="text-subtitle2 q-mb-sm">Output Format</div>
          <q-list bordered separator>
            <q-item
              v-for="format in outputFormats"
              :key="format.value"
              tag="label"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-radio v-model="localFormat" :val="format.value" @update:model-value="onFormatChange" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ format.label }}</q-item-label>
                <q-item-label caption>{{ format.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Additional Settings</div>
      <q-list>
        <q-item tag="label" v-ripple>
          <q-item-section avatar>
            <q-checkbox v-model="localSettings.includeSourceReferences" @update:model-value="onSettingsChange" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Include source references</q-item-label>
            <q-item-label caption>Add page/section references to extracted information</q-item-label>
          </q-item-section>
        </q-item>
        <q-item tag="label" v-ripple>
          <q-item-section avatar>
            <q-checkbox v-model="localSettings.generateVisualizations" @update:model-value="onSettingsChange" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Generate data visualizations</q-item-label>
            <q-item-label caption>Create charts and graphs from numerical data</q-item-label>
          </q-item-section>
        </q-item>
        <q-item tag="label" v-ripple>
          <q-item-section avatar>
            <q-checkbox v-model="localSettings.enableFollowUpQuestions" @update:model-value="onSettingsChange" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Enable follow-up questions</q-item-label>
            <q-item-label caption>AI may ask clarifying questions for better results</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Processing Summary</div>
      <q-markup-table flat bordered>
        <tbody>
          <tr>
            <td class="text-weight-medium">Files</td>
            <td>{{ summary.files }}</td>
          </tr>
          <tr>
            <td class="text-weight-medium">Task</td>
            <td class="text-truncate" style="max-width: 300px">{{ summary.task }}</td>
          </tr>
          <tr>
            <td class="text-weight-medium">Processing Mode</td>
            <td>{{ summary.mode }}</td>
          </tr>
          <tr>
            <td class="text-weight-medium">Output Format</td>
            <td>{{ summary.format }}</td>
          </tr>
          <tr>
            <td class="text-weight-medium">AI Model</td>
            <td>{{ summary.model }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface AdditionalSettings {
  includeSourceReferences: boolean;
  generateVisualizations: boolean;
  enableFollowUpQuestions: boolean;
}

interface Summary {
  files: string;
  task: string;
  mode: string;
  format: string;
  model: string;
}

const props = defineProps<{
  processingMode: string;
  outputFormat: string;
  additionalSettings: AdditionalSettings;
  summary: Summary;
}>();

const emit = defineEmits<{
  (e: 'update:processingMode', value: string): void;
  (e: 'update:outputFormat', value: string): void;
  (e: 'update:additionalSettings', value: AdditionalSettings): void;
}>();

const localMode = ref(props.processingMode);
const localFormat = ref(props.outputFormat);
const localSettings = ref({ ...props.additionalSettings });

const processingModes = [
  {
    value: 'standard',
    label: 'Standard Processing',
    description: 'Balanced accuracy and speed'
  },
  {
    value: 'high_precision',
    label: 'High Precision',
    description: 'More accurate but slower processing'
  },
  {
    value: 'quick_draft',
    label: 'Quick Draft',
    description: 'Faster processing with basic accuracy'
  }
];

const outputFormats = [
  {
    value: 'rich_text',
    label: 'Rich Text',
    description: 'Formatted text with tables and styling'
  },
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Professional looking document format'
  },
  {
    value: 'plain_text',
    label: 'Plain Text',
    description: 'Simple text without formatting'
  }
];

watch(() => props.processingMode, (newVal) => {
  localMode.value = newVal;
});

watch(() => props.outputFormat, (newVal) => {
  localFormat.value = newVal;
});

watch(() => props.additionalSettings, (newVal) => {
  localSettings.value = { ...newVal };
}, { deep: true });

function onModeChange(value: string | number | boolean | null) {
  emit('update:processingMode', String(value));
}

function onFormatChange(value: string | number | boolean | null) {
  emit('update:outputFormat', String(value));
}

function onSettingsChange() {
  emit('update:additionalSettings', { ...localSettings.value });
}
</script>
