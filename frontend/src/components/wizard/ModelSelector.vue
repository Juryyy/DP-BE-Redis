<template>
  <q-card flat bordered class="model-selector-card">
    <q-card-section>
      <div class="text-h5 q-mb-xs">
        <q-icon name="psychology" size="sm" class="q-mr-sm" />
        Select AI Model
      </div>
      <div class="text-body2 text-grey-7">
        Choose the AI provider and model for processing your documents.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle1 text-weight-medium q-mb-md">AI Provider</div>

      <div class="row q-col-gutter-md">
        <div
          v-for="[key, provider] in Object.entries(providers)"
          :key="key"
          class="col-12 col-md-6"
        >
          <q-card
            flat
            bordered
            clickable
            :class="[
              'provider-card',
              {
                'selected': selectedProvider === key,
                'disabled': !provider.available
              }
            ]"
            @click="provider.available && onProviderChange(key)"
          >
            <q-card-section>
              <div class="row items-center">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">
                    {{ provider.name }}
                    <q-badge
                      v-if="provider.type === 'local'"
                      color="positive"
                      label="Local"
                      class="q-ml-sm"
                    />
                    <q-badge
                      v-else-if="provider.type === 'remote'"
                      color="info"
                      label="Remote"
                      class="q-ml-sm"
                    />
                    <q-badge
                      v-else
                      color="warning"
                      label="API"
                      class="q-ml-sm"
                    />
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    {{ provider.description }}
                  </div>
                  <div v-if="!provider.available" class="text-caption text-negative q-mt-xs">
                    <q-icon name="warning" size="xs" /> Not configured
                  </div>
                </div>
                <div class="col-auto">
                  <q-radio
                    :model-value="selectedProvider"
                    :val="key"
                    :disable="!provider.available"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </q-card-section>

    <q-card-section v-if="currentProvider?.requiresApiKey" class="bg-grey-1">
      <q-banner dense class="bg-info text-white q-mb-md">
        <template #avatar>
          <q-icon name="vpn_key" />
        </template>
        This provider requires an API key to function
      </q-banner>

      <q-input
        v-model="apiKey"
        :label="`${currentProvider?.name} API Key`"
        type="password"
        filled
        :rules="[(val: string) => !!val || 'API Key is required']"
        @update:model-value="onApiKeyChange"
      >
        <template #prepend>
          <q-icon name="vpn_key" />
        </template>
        <template #hint>
          <q-icon name="lock" size="xs" class="q-mr-xs" />
          Your API key is encrypted and stored securely
        </template>
      </q-input>
    </q-card-section>

    <q-card-section v-if="currentProvider">
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-subtitle1 text-weight-medium">Select Model(s)</div>
          <div class="text-caption text-grey-7">You can select multiple models for comparison</div>
        </div>
        <div v-if="selectedModels.length > 1" class="col-auto">
          <q-chip
            outline
            color="primary"
            icon="workspaces"
            :label="`${selectedModels.length} models selected`"
          />
        </div>
      </div>

      <q-list bordered separator>
        <q-item
          v-for="model in currentProvider.models"
          :key="model.id"
          clickable
          :active="selectedModels.includes(model.id)"
          active-class="bg-blue-1"
          @click="onModelToggle(model.id)"
        >
          <q-item-section avatar>
            <q-checkbox
              :model-value="selectedModels.includes(model.id)"
              color="primary"
              @click.stop
              @update:model-value="onModelToggle(model.id)"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ model.name }}
              <q-badge
                v-if="model.recommended"
                color="positive"
                label="⭐ Recommended"
                class="q-ml-sm"
              />
              <q-badge
                v-if="selectedModels[0] === model.id && selectedModels.length > 1"
                color="info"
                label="Primary"
                class="q-ml-sm"
              />
            </q-item-label>
            <q-item-label caption lines="1" class="q-mt-xs">
              <q-icon name="memory" size="xs" class="q-mr-xs" />
              {{ formatNumber(model.contextWindow) }} tokens context
              <span v-if="model.costPer1kTokens" class="q-ml-md">
                <q-icon name="payments" size="xs" class="q-mr-xs" />
                ${{ model.costPer1kTokens }}/1K tokens
              </span>
              <span v-if="model.parameterSize" class="q-ml-md">
                <q-icon name="storage" size="xs" class="q-mr-xs" />
                {{ model.parameterSize }}
              </span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-banner v-if="selectedModels.length > 1" dense class="bg-info text-white q-mt-md">
        <template #avatar>
          <q-icon name="info" />
        </template>
        Multiple models selected. The system will compare results from all selected models.
      </q-banner>
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
import type { AIProvider, AIProviders, ProviderOptions } from 'src/types/ai.types';

const props = defineProps<{
  providers: AIProviders;
  selectedProvider: string;
  selectedModel: string;
  selectedModels?: string[];
  apiKeys: Record<string, string>;
  options: ProviderOptions;
}>();

const emit = defineEmits<{
  (e: 'update:selectedProvider', value: string): void;
  (e: 'update:selectedModel', value: string): void;
  (e: 'toggle-model', modelId: string): void;
  (e: 'update:apiKey', provider: string, key: string): void;
  (e: 'update:options', options: ProviderOptions): void;
  (e: 'refresh'): void;
}>();

const selectedProvider = ref(props.selectedProvider);
const selectedModel = ref(props.selectedModel);
const selectedModels = ref<string[]>(props.selectedModels || []);
const apiKey = ref(props.apiKeys[props.selectedProvider] || '');
const localOptions = ref({ ...props.options });

watch(() => props.selectedProvider, (newVal) => {
  selectedProvider.value = newVal;
  apiKey.value = props.apiKeys[newVal] || '';
});

watch(() => props.selectedModel, (newVal) => {
  selectedModel.value = newVal;
});

watch(() => props.selectedModels, (newVal) => {
  selectedModels.value = newVal || [];
});

watch(() => props.options, (newVal) => {
  localOptions.value = { ...newVal };
}, { deep: true });

const hasProviders = computed(() => Object.keys(props.providers).length > 0);

const currentProvider = computed(() => props.providers[selectedProvider.value]);


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
  selectedModels.value = [];
  // Auto-select first or recommended model
  const provider = props.providers[value];
  if (provider && provider.models.length > 0) {
    const recommended = provider.models.find(m => m.recommended);
    const newModel = recommended ? recommended.id : provider.models[0].id;
    selectedModel.value = newModel;
    selectedModels.value = [newModel];
    emit('update:selectedModel', newModel);
    emit('toggle-model', newModel);
  }
}

function onModelToggle(modelId: string) {
  emit('toggle-model', modelId);
}

function onApiKeyChange(value: string | number | null) {
  emit('update:apiKey', selectedProvider.value, String(value || ''));
}

function onOptionsChange() {
  emit('update:options', { ...localOptions.value });
}
</script>

<style scoped>
.model-selector-card {
  min-height: 400px;
}

.provider-card {
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.provider-card.selected {
  border-color: var(--q-primary);
  background-color: rgba(var(--q-primary-rgb), 0.05);
}

.provider-card:not(.disabled):hover {
  border-color: var(--q-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.provider-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
