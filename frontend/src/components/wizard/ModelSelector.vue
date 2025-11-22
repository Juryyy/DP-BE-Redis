<template>
  <div class="model-selector-compact">
    <!-- Info Banner -->
    <q-banner dense rounded class="info-banner q-mb-sm">
      <template #avatar>
        <q-icon name="info" color="info" />
      </template>
      <div class="row items-center justify-between full-width">
        <span class="text-caption">Model selection is optional. Leave unselected to use default.</span>
        <q-btn
          flat
          dense
          icon="refresh"
          color="primary"
          @click="$emit('refresh')"
          size="xs"
          label="Reload"
        >
          <q-tooltip>Reload providers</q-tooltip>
        </q-btn>
      </div>
    </q-banner>

    <!-- Selected Models Summary -->
    <div v-if="selectedModels.length > 0" class="selected-summary q-mb-md">
      <q-chip
        v-for="(sel, idx) in selectedModels"
        :key="`${sel.provider}-${sel.modelId}`"
        removable
        :color="getProviderColor(sel.provider)"
        text-color="white"
        size="sm"
        @remove="$emit('toggle-model', sel.provider, sel.modelId)"
      >
        {{ getModelName(sel.provider, sel.modelId) }}
      </q-chip>
    </div>

    <!-- Providers -->
    <q-expansion-item
      v-for="[providerId, provider] in Object.entries(providers)"
      :key="providerId"
      :label="provider.name"
      :caption="provider.available ? `${provider.models.length} models available` : 'Not configured'"
      :icon="getProviderIcon(provider.type)"
      :disable="!provider.available"
      class="provider-expansion q-mb-xs"
      header-class="provider-header-compact"
    >
      <template #header>
        <q-item-section avatar>
          <q-avatar :color="getProviderColor(providerId)" text-color="white" size="32px">
            <q-icon :name="getProviderIcon(provider.type)" size="sm" />
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">{{ provider.name }}</q-item-label>
          <q-item-label caption class="text-caption">
            {{ provider.available ? `${provider.models.length} models` : 'Not configured' }}
          </q-item-label>
        </q-item-section>

        <q-item-section side v-if="getSelectedCountForProvider(providerId) > 0">
          <q-chip
            dense
            :color="getProviderColor(providerId)"
            text-color="white"
            size="sm"
          >
            {{ getSelectedCountForProvider(providerId) }} selected
          </q-chip>
        </q-item-section>
      </template>

      <q-card flat bordered class="models-card">
        <q-card-section class="q-pa-sm">
          <!-- API Key Input -->
          <div v-if="provider.requiresApiKey" class="q-mb-sm">
            <q-input
              :model-value="apiKeys[providerId] || ''"
              label="API Key"
              type="password"
              dense
              outlined
              bg-color="white"
              @update:model-value="(val) => $emit('update:apiKey', providerId, val)"
            >
              <template #prepend>
                <q-icon name="vpn_key" size="xs" />
              </template>
            </q-input>
          </div>

          <!-- Models List -->
          <q-list dense bordered separator class="models-list">
            <q-item
              v-for="model in provider.models"
              :key="model.id"
              clickable
              @click="$emit('toggle-model', providerId, model.id)"
              class="model-item"
            >
              <q-item-section avatar>
                <q-checkbox
                  :model-value="isModelSelected(providerId, model.id)"
                  :color="getProviderColor(providerId)"
                  size="sm"
                  dense
                  @update:model-value="$emit('toggle-model', providerId, model.id)"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label class="model-label">
                  {{ model.name }}
                  <q-icon v-if="model.recommended" name="star" color="amber-7" size="xs" class="q-ml-xs" />
                </q-item-label>
                <q-item-label caption class="model-caption">
                  <span class="meta-item">
                    <q-icon name="memory" size="xs" /> {{ formatNumber(model.contextWindow) }} tokens
                  </span>
                  <span v-if="model.costPer1kTokens" class="meta-item q-ml-sm">
                    <q-icon name="payments" size="xs" /> ${{ model.costPer1kTokens }}/1K
                  </span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-expansion-item>

    <!-- No providers available -->
    <div v-if="Object.keys(providers).length === 0" class="no-providers q-pa-md text-center">
      <q-icon name="cloud_off" size="md" color="grey-5" class="q-mb-sm" />
      <p class="text-grey-6 text-body2 q-ma-none">No providers available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AIProviders, ProviderOptions } from 'src/types/ai.types';

const props = defineProps<{
  providers: AIProviders;
  selectedModels: Array<{ provider: string; modelId: string }>;
  apiKeys: Record<string, string>;
  options: ProviderOptions;
}>();

defineEmits<{
  'toggle-model': [provider: string, modelId: string];
  'update:apiKey': [provider: string, apiKey: string];
  'update:options': [options: ProviderOptions];
  'refresh': [];
}>();

function isModelSelected(providerId: string, modelId: string): boolean {
  return props.selectedModels.some(
    m => m.provider === providerId && m.modelId === modelId
  );
}

function getSelectedCountForProvider(providerId: string): number {
  return props.selectedModels.filter(m => m.provider === providerId).length;
}

function getProviderIcon(type: string): string {
  const icons: Record<string, string> = {
    local: 'computer',
    remote: 'cloud',
    api: 'api'
  };
  return icons[type] || 'cloud';
}

function getProviderColor(providerId: string): string {
  const colors: Record<string, string> = {
    ollama: 'blue-7',
    openai: 'green-7',
    anthropic: 'purple-7',
    gemini: 'orange-7'
  };
  return colors[providerId] || 'grey-7';
}

function getModelName(providerId: string, modelId: string): string {
  const provider = props.providers[providerId];
  if (!provider) return modelId;

  const model = provider.models.find(m => m.id === modelId);
  return model?.name || modelId;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}
</script>

<style lang="scss" scoped>
.model-selector-compact {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.info-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;

  :deep(.q-banner__content) {
    font-size: 0.9rem;
  }
}

.selected-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.provider-expansion {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  background: white;

  :deep(.q-item) {
    padding: 0.75rem 1rem;
    min-height: auto;
  }

  :deep(.q-item-label) {
    font-size: 0.9rem;
  }

  :deep(.q-item-label--caption) {
    font-size: 0.8rem;
  }

  :deep(.q-expansion-item__container) {
    border-top: 1px solid #e5e7eb;
  }
}

.provider-header-compact {
  &:hover {
    background: #f9fafb;
  }
}

.models-card {
  background: #fafafa;
  margin: 0;
}

.models-list {
  border-radius: 4px;
  overflow: hidden;
  background: white;
}

.model-item {
  padding: 0.5rem 0.75rem;
  min-height: auto;

  &:hover {
    background: #f9fafb;
  }
}

.model-label {
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.model-caption {
  font-size: 0.8rem;
  margin-top: 0.125rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #6b7280;
  font-size: 0.8rem;
}

.no-providers {
  border: 2px dashed #cbd5e0;
  border-radius: 8px;
  background: #fafafa;
}

/* Responsive Design */
@media (max-width: 600px) {
  .selected-summary {
    padding: 0.5rem;
  }

  .provider-expansion {
    :deep(.q-item) {
      padding: 0.6rem 0.75rem;
    }
  }
}
</style>
