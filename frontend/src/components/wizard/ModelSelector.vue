<template>
  <q-card flat bordered class="model-selector-card">
    <q-card-section>
      <div class="text-h5 q-mb-xs">
        <q-icon name="psychology" size="sm" class="q-mr-sm" />
        Select AI Models
      </div>
      <div class="text-body2 text-grey-7">
        Select one or more models from any provider. Models will run in parallel for comparison.
      </div>
    </q-card-section>

    <q-separator />

    <!-- Selection Summary -->
    <q-card-section v-if="selectedModels.length > 0" class="bg-blue-1">
      <div class="row items-center">
        <q-icon name="check_circle" color="primary" size="md" class="q-mr-md" />
        <div class="col">
          <div class="text-subtitle2 text-weight-medium">
            {{ selectedModels.length }} model{{ selectedModels.length > 1 ? 's' : '' }} selected
          </div>
          <div class="text-caption">
            <span v-for="(sel, idx) in selectedModels" :key="`${sel.provider}-${sel.modelId}`">
              {{ getProviderName(sel.provider) }}: {{ getModelName(sel.provider, sel.modelId) }}
              <span v-if="idx < selectedModels.length - 1">, </span>
            </span>
          </div>
        </div>
      </div>
    </q-card-section>

    <q-separator v-if="selectedModels.length > 0" />

    <!-- Provider Accordion -->
    <div v-for="[providerId, provider] in Object.entries(providers)" :key="providerId">
      <q-expansion-item
        :default-opened="provider.available"
        :disable="!provider.available"
        :header-class="provider.available ? '' : 'text-grey-6'"
      >
        <template #header>
          <q-item-section avatar>
            <q-avatar :color="provider.available ? getProviderColor(provider.type) : 'grey-4'" text-color="white" size="48px">
              <q-icon :name="getProviderIcon(provider.type)" />
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-weight-medium">
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
            </q-item-label>
            <q-item-label caption>
              {{ provider.description }}
            </q-item-label>
            <q-item-label v-if="!provider.available" caption class="text-negative">
              <q-icon name="warning" size="xs" /> Not configured
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-chip
              v-if="getSelectedCountForProvider(providerId) > 0"
              color="primary"
              text-color="white"
              :label="`${getSelectedCountForProvider(providerId)} selected`"
            />
          </q-item-section>
        </template>

        <!-- API Key Input -->
        <q-card-section v-if="provider.requiresApiKey" class="bg-grey-1">
          <q-input
            :model-value="apiKeys[providerId] || ''"
            :label="`${provider.name} API Key`"
            type="password"
            filled
            dense
            @update:model-value="(val) => $emit('update:apiKey', providerId, val)"
          >
            <template #prepend>
              <q-icon name="vpn_key" />
            </template>
            <template #hint>
              Required to use this provider
            </template>
          </q-input>
        </q-card-section>

        <!-- Model List -->
        <q-list v-if="provider.models.length > 0" bordered separator>
          <q-item
            v-for="model in provider.models"
            :key="model.id"
            clickable
            :active="isModelSelected(providerId, model.id)"
            active-class="bg-blue-1"
            @click="$emit('toggle-model', providerId, model.id)"
          >
            <q-item-section avatar>
              <q-checkbox
                :model-value="isModelSelected(providerId, model.id)"
                color="primary"
                @click.stop
                @update:model-value="$emit('toggle-model', providerId, model.id)"
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
              </q-item-label>
              <q-item-label caption lines="1" class="q-mt-xs">
                <q-icon name="memory" size="xs" class="q-mr-xs" />
                {{ formatNumber(model.contextWindow) }} tokens
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

        <q-card-section v-else>
          <q-banner class="bg-grey-2">
            <template #avatar>
              <q-icon name="info" color="grey-6" />
            </template>
            No models available for this provider
          </q-banner>
        </q-card-section>
      </q-expansion-item>
      <q-separator />
    </div>

    <!-- Advanced Options -->
    <q-expansion-item
      icon="tune"
      label="Advanced Options"
      caption="Temperature, Max Tokens, Top P"
      class="q-mt-md"
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

    <!-- No Providers Warning -->
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
import type { AIProviders, ProviderOptions } from 'src/types/ai.types';

const props = defineProps<{
  providers: AIProviders;
  selectedModels: Array<{ provider: string; modelId: string }>;
  apiKeys: Record<string, string>;
  options: ProviderOptions;
}>();

const emit = defineEmits<{
  (e: 'toggle-model', provider: string, modelId: string): void;
  (e: 'update:apiKey', provider: string, key: string): void;
  (e: 'update:options', options: ProviderOptions): void;
  (e: 'refresh'): void;
}>();

const localOptions = ref({ ...props.options });

watch(() => props.options, (newVal) => {
  localOptions.value = { ...newVal };
}, { deep: true });

const hasProviders = computed(() => Object.keys(props.providers).length > 0);

function isModelSelected(provider: string, modelId: string): boolean {
  return props.selectedModels.some(m => m.provider === provider && m.modelId === modelId);
}

function getSelectedCountForProvider(providerId: string): number {
  return props.selectedModels.filter(m => m.provider === providerId).length;
}

function getProviderName(providerId: string): string {
  return props.providers[providerId]?.name || providerId;
}

function getModelName(providerId: string, modelId: string): string {
  const provider = props.providers[providerId];
  const model = provider?.models.find(m => m.id === modelId);
  return model?.name || modelId;
}

function getProviderIcon(type: string): string {
  switch (type) {
    case 'local': return 'computer';
    case 'remote': return 'cloud';
    case 'api': return 'api';
    default: return 'psychology';
  }
}

function getProviderColor(type: string): string {
  switch (type) {
    case 'local': return 'positive';
    case 'remote': return 'info';
    case 'api': return 'warning';
    default: return 'grey';
  }
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

function onOptionsChange() {
  emit('update:options', { ...localOptions.value });
}
</script>

<style scoped>
.model-selector-card {
  min-height: 400px;
}
</style>
