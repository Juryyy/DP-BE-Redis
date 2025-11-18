<template>
  <div class="model-selector">
    <!-- Header -->
    <div class="selector-header">
      <div class="header-icon-wrapper">
        <q-icon name="psychology" size="40px" class="header-icon" />
      </div>
      <h3 class="selector-title">Choose Your AI Models</h3>
      <p class="selector-subtitle">Select multiple models to run in parallel and compare results</p>
    </div>

    <!-- Selection Summary -->
    <transition name="summary-slide">
      <div v-if="selectedModels.length > 0" class="selection-summary">
        <div class="summary-content">
          <q-icon name="check_circle" class="summary-icon" />
          <div class="summary-text">
            <div class="summary-count">
              <strong>{{ selectedModels.length }}</strong> model{{ selectedModels.length > 1 ? 's' : '' }} selected
            </div>
            <div class="summary-details">
              <span v-for="(sel, idx) in selectedModels" :key="`${sel.provider}-${sel.modelId}`">
                {{ getProviderName(sel.provider) }}: {{ getModelName(sel.provider, sel.modelId) }}{{  idx < selectedModels.length - 1 ? ', ' : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Provider Cards -->
    <div class="providers-grid">
      <div
        v-for="[providerId, provider] in Object.entries(providers)"
        :key="providerId"
        class="provider-card"
        :class="{ 'provider-disabled': !provider.available }"
      >
        <div class="provider-header" :style="{ background: getProviderGradient(providerId) }">
          <div class="provider-header-content">
            <q-avatar size="56px" :color="provider.available ? 'white' : 'grey-4'">
              <q-icon :name="getProviderIcon(provider.type)" :color="getProviderIconColor(providerId)" size="32px" />
            </q-avatar>
            <div class="provider-info">
              <div class="provider-name">{{ provider.name }}</div>
              <div class="provider-description">{{ provider.description }}</div>
            </div>
          </div>
          <div class="provider-badges">
            <q-chip
              v-if="provider.type === 'local'"
              dense
              color="white"
              text-color="positive"
              icon="computer"
              label="Local"
            />
            <q-chip
              v-else-if="provider.type === 'remote'"
              dense
              color="white"
              text-color="info"
              icon="cloud"
              label="Remote"
            />
            <q-chip
              v-else
              dense
              color="white"
              text-color="warning"
              icon="api"
              label="API"
            />
            <q-chip
              v-if="getSelectedCountForProvider(providerId) > 0"
              dense
              :color="getProviderIconColor(providerId)"
              text-color="white"
              icon="check_circle"
              :label="`${getSelectedCountForProvider(providerId)}`"
            />
          </div>
        </div>

        <div v-if="!provider.available" class="provider-unavailable">
          <q-icon name="warning" size="md" />
          <p>Provider not configured</p>
        </div>

        <div v-else class="provider-content">
          <!-- API Key Input -->
          <div v-if="provider.requiresApiKey" class="api-key-section">
            <q-input
              :model-value="apiKeys[providerId] || ''"
              label="API Key Required"
              type="password"
              filled
              dense
              bg-color="grey-2"
              @update:model-value="(val) => $emit('update:apiKey', providerId, val)"
            >
              <template #prepend>
                <q-icon name="vpn_key" color="primary" />
              </template>
            </q-input>
          </div>

          <!-- Models Grid -->
          <div v-if="provider.models.length > 0" class="models-grid">
            <div
              v-for="model in provider.models"
              :key="model.id"
              class="model-card"
              :class="{ 'model-selected': isModelSelected(providerId, model.id) }"
              @click="$emit('toggle-model', providerId, model.id)"
            >
              <div class="model-checkbox-wrapper">
                <q-checkbox
                  :model-value="isModelSelected(providerId, model.id)"
                  :color="getProviderIconColor(providerId)"
                  size="md"
                  @click.stop
                  @update:model-value="$emit('toggle-model', providerId, model.id)"
                />
              </div>
              <div class="model-info">
                <div class="model-name">
                  {{ model.name }}
                  <q-icon v-if="model.recommended" name="star" color="amber" size="sm" class="q-ml-xs" />
                </div>
                <div class="model-meta">
                  <span class="meta-badge">
                    <q-icon name="memory" size="xs" />
                    {{ formatNumber(model.contextWindow) }}
                  </span>
                  <span v-if="model.costPer1kTokens" class="meta-badge">
                    <q-icon name="payments" size="xs" />
                    ${{ model.costPer1kTokens }}/1K
                  </span>
                  <span v-if="model.parameterSize" class="meta-badge">
                    <q-icon name="storage" size="xs" />
                    {{ model.parameterSize }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-models">
            <q-icon name="inbox" size="md" color="grey-6" />
            <p>No models available</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced Options -->
    <div class="advanced-options">
      <div class="options-header" @click="showAdvanced = !showAdvanced">
        <q-icon name="tune" size="md" class="options-icon" />
        <div class="options-title">
          <h4>Advanced Options</h4>
          <p>Fine-tune model parameters</p>
        </div>
        <q-icon :name="showAdvanced ? 'expand_less' : 'expand_more'" size="md" />
      </div>

      <transition name="options-expand">
        <div v-if="showAdvanced" class="options-content">
          <div class="options-grid">
            <div class="option-control">
              <label class="option-label">
                Temperature
                <span class="option-value">{{ localOptions.temperature.toFixed(1) }}</span>
              </label>
              <q-slider
                v-model="localOptions.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                color="purple-6"
                track-color="grey-3"
                thumb-color="purple-6"
                @update:model-value="onOptionsChange"
              />
              <div class="option-hint">Lower = focused • Higher = creative</div>
            </div>

            <div class="option-control">
              <label class="option-label">
                Max Tokens
                <span class="option-value">{{ formatNumber(localOptions.maxTokens) }}</span>
              </label>
              <q-slider
                v-model.number="localOptions.maxTokens"
                :min="100"
                :max="128000"
                :step="100"
                color="blue-6"
                track-color="grey-3"
                thumb-color="blue-6"
                @update:model-value="onOptionsChange"
              />
              <div class="option-hint">Maximum response length</div>
            </div>

            <div class="option-control">
              <label class="option-label">
                Top P
                <span class="option-value">{{ localOptions.topP.toFixed(2) }}</span>
              </label>
              <q-slider
                v-model="localOptions.topP"
                :min="0"
                :max="1"
                :step="0.05"
                color="green-6"
                track-color="grey-3"
                thumb-color="green-6"
                @update:model-value="onOptionsChange"
              />
              <div class="option-hint">Nucleus sampling parameter</div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- No Providers Warning -->
    <div v-if="!hasProviders" class="no-providers">
      <q-icon name="warning" size="80px" color="warning" />
      <h4>No AI Providers Available</h4>
      <p>Please check your backend configuration and try again.</p>
      <q-btn unelevated color="primary" label="Retry" icon="refresh" @click="$emit('refresh')" />
    </div>
  </div>
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
const showAdvanced = ref(false);

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

function getProviderGradient(providerId: string): string {
  const gradients: Record<string, string> = {
    ollama: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    openai: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)',
    anthropic: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
    gemini: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)'
  };
  return gradients[providerId] || 'linear-gradient(135deg, #718096 0%, #4a5568 100%)';
}

function getProviderIconColor(providerId: string): string {
  const colors: Record<string, string> = {
    ollama: 'blue-7',
    openai: 'green-7',
    anthropic: 'purple-7',
    gemini: 'orange-7'
  };
  return colors[providerId] || 'grey-7';
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

function onOptionsChange() {
  emit('update:options', { ...localOptions.value });
}
</script>

<style scoped lang="scss">
.model-selector {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.selector-header {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 16px;
  border: 2px solid #e2e8f0;
}

.header-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  margin-bottom: 1rem;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.header-icon {
  color: white;
}

.selector-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 0.5rem;
}

.selector-subtitle {
  font-size: 1rem;
  color: #718096;
  margin: 0;
}

/* Selection Summary */
.selection-summary {
  padding: 1.5rem;
  background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%);
  border-radius: 12px;
  border: 2px solid #81e6d9;
  animation: slideDown 0.4s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-icon {
  font-size: 2.5rem;
  color: #38a169;
}

.summary-text {
  flex: 1;
}

.summary-count {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.summary-details {
  font-size: 0.9rem;
  color: #4a5568;
}

/* Providers Grid */
.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 1.5rem;
}

.provider-card {
  background: white;
  border-radius: 16px;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeInUp 0.5s ease;
}

.provider-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  border-color: #cbd5e0;
}

.provider-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.provider-header {
  padding: 1.5rem;
  color: white;
  position: relative;
  overflow: hidden;
}

.provider-header::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.provider-header-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.provider-info {
  flex: 1;
}

.provider-name {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.provider-description {
  font-size: 0.9rem;
  opacity: 0.95;
}

.provider-badges {
  position: relative;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.provider-unavailable {
  text-align: center;
  padding: 3rem 2rem;
  color: #718096;
}

.provider-unavailable q-icon {
  margin-bottom: 0.75rem;
}

.provider-unavailable p {
  margin: 0;
  font-size: 1rem;
}

.provider-content {
  padding: 1.5rem;
}

.api-key-section {
  margin-bottom: 1.5rem;
}

/* Models Grid */
.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.model-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.model-card:hover {
  background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%);
  border-color: #cbd5e0;
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.model-selected {
  background: linear-gradient(135deg, #ebf4ff 0%, #c3dafe 100%);
  border-color: #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
}

.model-checkbox-wrapper {
  flex-shrink: 0;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
}

.model-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #718096;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

.no-models {
  text-align: center;
  padding: 2rem;
  color: #a0aec0;
}

.no-models p {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
}

/* Advanced Options */
.advanced-options {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
}

.options-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  cursor: pointer;
  transition: background 0.3s ease;
}

.options-header:hover {
  background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%);
}

.options-icon {
  color: #667eea;
}

.options-title {
  flex: 1;
}

.options-title h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.25rem;
}

.options-title p {
  font-size: 0.85rem;
  color: #718096;
  margin: 0;
}

.options-content {
  padding: 1.5rem;
  animation: expandDown 0.3s ease;
}

@keyframes expandDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.option-control {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: #2d3748;
}

.option-value {
  color: #667eea;
  font-size: 1.1rem;
}

.option-hint {
  font-size: 0.8rem;
  color: #a0aec0;
  margin-top: -0.5rem;
}

/* No Providers */
.no-providers {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
  border-radius: 16px;
  border: 2px solid #fc8181;
}

.no-providers h4 {
  font-size: 1.5rem;
  color: #2d3748;
  margin: 1rem 0 0.5rem;
}

.no-providers p {
  color: #718096;
  margin: 0 0 1.5rem;
}

/* Transitions */
.summary-slide-enter-active,
.summary-slide-leave-active {
  transition: all 0.4s ease;
}

.summary-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.summary-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.options-expand-enter-active,
.options-expand-leave-active {
  transition: all 0.3s ease;
}

.options-expand-enter-from,
.options-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .providers-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .models-grid {
    grid-template-columns: 1fr;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>
