<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 2: Select AI Model</div>
      <div class="text-caption text-grey">
        Choose the AI provider and model for processing your documents.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">AI Provider</div>
      <q-btn-toggle
        v-model="selectedProvider"
        spread
        no-caps
        rounded
        toggle-color="primary"
        :options="providerOptions"
        @update:model-value="onProviderChange"
      />
    </q-card-section>

    <q-card-section v-if="currentProvider?.requiresApiKey">
      <q-input
        v-model="apiKey"
        :label="`${providerName} API Key`"
        type="password"
        outlined
        dense
        :rules="[(val: string) => !!val || 'API Key is required']"
        @update:model-value="onApiKeyChange"
      >
        <template #prepend>
          <q-icon name="vpn_key" />
        </template>
        <template #hint>
          Your API key is stored locally and never shared
        </template>
      </q-input>
    </q-card-section>

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Select Model</div>
      <q-option-group
        v-model="selectedModel"
        :options="modelOptions"
        type="radio"
        @update:model-value="onModelChange"
      >
        <template #label="opt">
          <q-item dense>
            <q-item-section>
              <q-item-label>{{ opt.label }}</q-item-label>
              <q-item-label caption>
                <q-icon name="memory" size="xs" class="q-mr-xs" />
                Context: {{ formatNumber(opt.contextWindow) }} tokens
                <span v-if="opt.cost" class="q-ml-sm">
                  <q-icon name="attach_money" size="xs" class="q-mr-xs" />
                  ${{ opt.cost }}/1K tokens
                </span>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge v-if="opt.recommended" color="positive" label="Recommended" />
            </q-item-section>
          </q-item>
        </template>
      </q-option-group>
    </q-card-section>

    <q-expansion-item
      icon="tune"
      label="Advanced Options"
      caption="Temperature, Max Tokens, Top P"
      class="q-mx-md q-mb-md"
    >
      <q-card>
        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <div class="text-caption q-mb-xs">
                Temperature: {{ localOptions.temperature.toFixed(1) }}
              </div>
              <q-slider
                v-model="localOptions.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                label
                color="primary"
                @update:model-value="onOptionsChange"
              />
              <div class="text-caption text-grey">
                Lower = more focused, Higher = more creative
              </div>
            </div>
            <div class="col-12 col-md-4">
              <q-input
                v-model.number="localOptions.maxTokens"
                type="number"
                label="Max Tokens"
                outlined
                dense
                :min="100"
                :max="128000"
                @update:model-value="onOptionsChange"
              />
              <div class="text-caption text-grey q-mt-xs">
                Maximum response length
              </div>
            </div>
            <div class="col-12 col-md-4">
              <div class="text-caption q-mb-xs">
                Top P: {{ localOptions.topP.toFixed(2) }}
              </div>
              <q-slider
                v-model="localOptions.topP"
                :min="0"
                :max="1"
                :step="0.05"
                label
                color="secondary"
                @update:model-value="onOptionsChange"
              />
              <div class="text-caption text-grey">
                Nucleus sampling parameter
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>

    <q-card-section v-if="!hasProviders">
      <q-banner class="bg-warning text-white">
        <template #avatar>
          <q-icon name="warning" />
        </template>
        No AI providers available. Please check your backend configuration.
        <template #action>
          <q-btn flat label="Retry" @click="$emit('refresh')" />
        </template>
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  recommended?: boolean;
  costPer1kTokens?: number;
}

interface AIProvider {
  type: 'local' | 'api' | 'remote';
  available: boolean;
  requiresApiKey?: boolean;
  models: AIModel[];
  baseUrl?: string;
}

interface ProviderOptions {
  temperature: number;
  maxTokens: number;
  topP: number;
}

const props = defineProps<{
  providers: Record<string, AIProvider>;
  selectedProvider: string;
  selectedModel: string;
  apiKeys: Record<string, string>;
  options: ProviderOptions;
}>();

const emit = defineEmits<{
  (e: 'update:selectedProvider', value: string): void;
  (e: 'update:selectedModel', value: string): void;
  (e: 'update:apiKey', provider: string, key: string): void;
  (e: 'update:options', options: ProviderOptions): void;
  (e: 'refresh'): void;
}>();

const selectedProvider = ref(props.selectedProvider);
const selectedModel = ref(props.selectedModel);
const apiKey = ref(props.apiKeys[props.selectedProvider] || '');
const localOptions = ref({ ...props.options });

watch(() => props.selectedProvider, (newVal) => {
  selectedProvider.value = newVal;
  apiKey.value = props.apiKeys[newVal] || '';
});

watch(() => props.selectedModel, (newVal) => {
  selectedModel.value = newVal;
});

watch(() => props.options, (newVal) => {
  localOptions.value = { ...newVal };
}, { deep: true });

const hasProviders = computed(() => Object.keys(props.providers).length > 0);

const currentProvider = computed(() => props.providers[selectedProvider.value]);

const providerName = computed(() => {
  const names: Record<string, string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini'
  };
  return names[selectedProvider.value] || selectedProvider.value;
});

const providerOptions = computed(() => {
  return Object.entries(props.providers).map(([key, provider]) => ({
    label: getProviderLabel(key),
    value: key,
    disable: !provider.available,
    slot: 'label'
  }));
});

const modelOptions = computed(() => {
  if (!currentProvider.value) return [];
  return currentProvider.value.models.map(model => ({
    label: model.name,
    value: model.id,
    contextWindow: model.contextWindow,
    cost: model.costPer1kTokens,
    recommended: model.recommended
  }));
});

function getProviderLabel(key: string): string {
  const labels: Record<string, string> = {
    ollama: 'Ollama (Local)',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini'
  };
  return labels[key] || key;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

function onProviderChange(value: string) {
  emit('update:selectedProvider', value);
  apiKey.value = props.apiKeys[value] || '';
  // Auto-select first or recommended model
  const provider = props.providers[value];
  if (provider && provider.models.length > 0) {
    const recommended = provider.models.find(m => m.recommended);
    const newModel = recommended ? recommended.id : provider.models[0].id;
    selectedModel.value = newModel;
    emit('update:selectedModel', newModel);
  }
}

function onModelChange(value: string) {
  emit('update:selectedModel', value);
}

function onApiKeyChange(value: string | number | null) {
  emit('update:apiKey', selectedProvider.value, String(value || ''));
}

function onOptionsChange() {
  emit('update:options', { ...localOptions.value });
}
</script>
