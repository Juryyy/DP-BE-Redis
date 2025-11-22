<template>
  <q-page class="model-management-page q-pa-md">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header q-mb-lg">
        <div>
          <h4 class="q-ma-none">Model Management</h4>
          <p class="text-grey-7 q-mb-none">Browse and download AI models for local processing</p>
        </div>
        <q-btn
          color="primary"
          icon="refresh"
          label="Refresh"
          @click="refreshInstalledModels"
          :loading="loading"
          unelevated
        >
          <q-tooltip>Auto-syncs with Ollama</q-tooltip>
        </q-btn>
      </div>

      <!-- Search and Filters -->
      <q-card class="filter-card q-mb-md">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input
                v-model="searchQuery"
                placeholder="Search models..."
                outlined
                dense
                clearable
              >
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select
                v-model="sizeFilter"
                :options="sizeOptions"
                label="Size"
                outlined
                dense
                emit-value
                map-options
              />
            </div>
            <div class="col-12 col-md-3">
              <q-select
                v-model="familyFilter"
                :options="familyOptions"
                label="Model Family"
                outlined
                dense
                emit-value
                map-options
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Installed Models -->
      <div v-if="installedModels.length > 0" class="q-mb-lg">
        <h5 class="text-h6 q-mb-md">
          <q-icon name="check_circle" color="positive" class="q-mr-sm" />
          Installed Models ({{ installedModels.length }})
        </h5>
        <div class="row q-col-gutter-md">
          <div
            v-for="model in installedModels"
            :key="model.name"
            class="col-12 col-md-6 col-lg-4"
          >
            <q-card class="model-card installed-model">
              <q-card-section>
                <div class="flex items-center justify-between q-mb-sm">
                  <div class="text-h6">{{ model.displayName || model.name }}</div>
                  <q-chip color="positive" text-color="white" size="sm">
                    <q-icon name="cloud_done" size="xs" class="q-mr-xs" />
                    Installed
                  </q-chip>
                </div>
                <div class="text-caption text-grey-7 q-mb-sm">{{ model.name }}</div>
                <div class="model-details">
                  <q-chip outline size="sm" v-if="model.size">
                    {{ formatSize(Number(model.size)) }}
                  </q-chip>
                  <q-chip outline size="sm" v-if="model.family">
                    {{ model.family }}
                  </q-chip>
                  <q-chip outline size="sm" v-if="model.contextWindow">
                    {{ model.contextWindow }}k context
                  </q-chip>
                </div>
              </q-card-section>
              <q-card-actions>
                <q-btn
                  flat
                  color="primary"
                  label="Test"
                  icon="play_arrow"
                  @click="testModel(model.name)"
                  size="sm"
                />
                <q-space />
                <div class="text-caption text-grey-6">
                  Used {{ model.usageCount || 0 }} times
                </div>
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Available Models to Download -->
      <div>
        <h5 class="text-h6 q-mb-md">
          <q-icon name="cloud_download" color="primary" class="q-mr-sm" />
          Available Models ({{ filteredModels.length }})
        </h5>
        <div class="row q-col-gutter-md">
          <div
            v-for="model in filteredModels"
            :key="model.id"
            class="col-12 col-md-6 col-lg-4"
          >
            <q-card class="model-card available-model">
              <q-card-section>
                <div class="flex items-center justify-between q-mb-sm">
                  <div class="text-h6">{{ model.name }}</div>
                  <q-badge v-if="model.recommended" color="orange" label="Recommended" />
                </div>
                <p class="text-body2 text-grey-7 q-mb-sm">{{ model.description }}</p>
                <div class="model-details q-mb-md">
                  <q-chip outline size="sm" icon="storage">
                    {{ model.size }}
                  </q-chip>
                  <q-chip outline size="sm" icon="family_restroom">
                    {{ model.family }}
                  </q-chip>
                  <q-chip
                    :color="getSpeedColor(model.speed)"
                    text-color="white"
                    size="sm"
                  >
                    {{ model.speed }}
                  </q-chip>
                </div>
                <div class="quality-rating">
                  <q-rating
                    v-model="model.quality"
                    max="5"
                    size="sm"
                    color="amber"
                    readonly
                  />
                  <span class="text-caption text-grey-7 q-ml-sm">Quality</span>
                </div>
              </q-card-section>
              <q-card-actions>
                <q-btn
                  v-if="!isInstalled(model.id)"
                  color="primary"
                  label="Pull Model"
                  icon="cloud_download"
                  @click="pullModel(model.id)"
                  :loading="pullingModels[model.id]"
                  unelevated
                  class="full-width"
                />
                <q-btn
                  v-else
                  color="positive"
                  label="Installed"
                  icon="check_circle"
                  disable
                  class="full-width"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>

        <div v-if="filteredModels.length === 0" class="text-center q-pa-xl">
          <q-icon name="search_off" size="4rem" color="grey-4" />
          <p class="text-grey-6">No models found matching your filters</p>
        </div>
      </div>
    </div>

    <!-- Progress Dialog -->
    <q-dialog v-model="pullProgress.show" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="cloud_download" color="primary" class="q-mr-sm" />
            Pulling {{ pullProgress.modelName }}
          </div>
          <div class="text-body2 text-grey-7 q-mb-md">
            {{ formatStatus(pullProgress.status) }}
          </div>
          <q-linear-progress
            :value="pullProgress.percentage / 100"
            color="primary"
            size="20px"
            class="q-mb-sm"
            :indeterminate="pullProgress.percentage === 0 && pullProgress.total === 0"
          >
            <div v-if="pullProgress.percentage > 0" class="absolute-full flex flex-center">
              <q-badge
                color="white"
                text-color="primary"
                :label="`${pullProgress.percentage}%`"
              />
            </div>
          </q-linear-progress>
          <div v-if="pullProgress.total > 0" class="text-caption text-grey-6 text-center">
            {{ formatBytes(pullProgress.completed) }} / {{ formatBytes(pullProgress.total) }}
          </div>
          <div v-else class="text-caption text-grey-6 text-center">
            Please wait...
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from 'boot/axios';
import { useQuasar } from 'quasar';

const $q = useQuasar();

interface AvailableModel {
  id: string;
  name: string;
  description: string;
  size: string;
  family: string;
  speed: string;
  quality: number;
  recommended?: boolean;
  contextWindow?: number;
}

interface InstalledModel {
  name: string;
  displayName?: string;
  size?: bigint;
  family?: string;
  contextWindow?: number;
  usageCount?: number;
}

const searchQuery = ref('');
const sizeFilter = ref('all');
const familyFilter = ref('all');
const loading = ref(false);
const installedModels = ref<InstalledModel[]>([]);
const pullingModels = ref<Record<string, boolean>>({});

// Progress tracking
const pullProgress = ref({
  show: false,
  modelName: '',
  status: '',
  percentage: 0,
  total: 0,
  completed: 0,
});

// Popular Ollama models curated list
const availableModels: AvailableModel[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2',
    description: 'Meta\'s latest compact model. Fast and efficient for most tasks.',
    size: '2GB',
    family: 'Llama',
    speed: 'Very Fast',
    quality: 4,
    recommended: true,
    contextWindow: 8,
  },
  {
    id: 'mistral:latest',
    name: 'Mistral 7B',
    description: 'Powerful 7B model with great performance. Excellent for production.',
    size: '4GB',
    family: 'Mistral',
    speed: 'Fast',
    quality: 5,
    recommended: true,
    contextWindow: 32,
  },
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    description: 'Meta\'s flagship 8B model. High quality responses.',
    size: '5GB',
    family: 'Llama',
    speed: 'Fast',
    quality: 5,
    contextWindow: 128,
  },
  {
    id: 'phi3',
    name: 'Phi-3',
    description: 'Microsoft\'s efficient small model. Great for quick tasks.',
    size: '2GB',
    family: 'Phi',
    speed: 'Very Fast',
    quality: 3,
    contextWindow: 4,
  },
  {
    id: 'gemma2:9b',
    name: 'Gemma 2 9B',
    description: 'Google\'s open model. Excellent reasoning capabilities.',
    size: '5GB',
    family: 'Gemma',
    speed: 'Fast',
    quality: 5,
    contextWindow: 8,
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    description: 'Alibaba\'s latest model. Strong multilingual support.',
    size: '4GB',
    family: 'Qwen',
    speed: 'Fast',
    quality: 4,
    contextWindow: 32,
  },
  {
    id: 'llama3.1:70b',
    name: 'Llama 3.1 70B',
    description: 'Meta\'s largest open model. Best quality, needs powerful hardware.',
    size: '40GB',
    family: 'Llama',
    speed: 'Slow',
    quality: 5,
    contextWindow: 128,
  },
  {
    id: 'codellama:13b',
    name: 'Code Llama 13B',
    description: 'Specialized for code generation and analysis.',
    size: '7GB',
    family: 'Llama',
    speed: 'Medium',
    quality: 5,
    contextWindow: 16,
  },
  {
    id: 'mistral-nemo',
    name: 'Mistral Nemo',
    description: '12B model with extended context. Great for long documents.',
    size: '7GB',
    family: 'Mistral',
    speed: 'Medium',
    quality: 5,
    contextWindow: 128,
  },
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    description: 'Advanced coding model with strong programming abilities.',
    size: '8GB',
    family: 'DeepSeek',
    speed: 'Medium',
    quality: 5,
    contextWindow: 16,
  },
];

const sizeOptions = [
  { label: 'All Sizes', value: 'all' },
  { label: 'Small (< 3GB)', value: 'small' },
  { label: 'Medium (3-8GB)', value: 'medium' },
  { label: 'Large (> 8GB)', value: 'large' },
];

const familyOptions = [
  { label: 'All Families', value: 'all' },
  { label: 'Llama', value: 'Llama' },
  { label: 'Mistral', value: 'Mistral' },
  { label: 'Gemma', value: 'Gemma' },
  { label: 'Qwen', value: 'Qwen' },
  { label: 'Phi', value: 'Phi' },
  { label: 'DeepSeek', value: 'DeepSeek' },
];

const filteredModels = computed(() => {
  return availableModels.filter((model) => {
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      if (
        !model.name.toLowerCase().includes(query) &&
        !model.description.toLowerCase().includes(query) &&
        !model.id.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Size filter
    if (sizeFilter.value !== 'all') {
      const sizeGB = parseInt(model.size);
      if (sizeFilter.value === 'small' && sizeGB >= 3) return false;
      if (sizeFilter.value === 'medium' && (sizeGB < 3 || sizeGB > 8)) return false;
      if (sizeFilter.value === 'large' && sizeGB <= 8) return false;
    }

    // Family filter
    if (familyFilter.value !== 'all' && model.family !== familyFilter.value) {
      return false;
    }

    return true;
  });
});

onMounted(async () => {
  // Backend auto-syncs with Ollama when fetching models
  await refreshInstalledModels();
});

async function syncModels() {
  try {
    const response = await api.post('/api/admin/models/sync');
    if (response.data.success) {
      console.log('Models synced:', response.data.data);
    }
  } catch (error: any) {
    console.error('Failed to sync models:', error);
    $q.notify({
      type: 'warning',
      message: 'Could not sync models with Ollama',
      caption: 'Database may be out of sync',
      timeout: 3000,
    });
  }
}

async function refreshInstalledModels() {
  loading.value = true;
  try {
    const response = await api.get('/api/admin/models');
    if (response.data.success) {
      installedModels.value = response.data.data.models;
    }
  } catch (error: any) {
    console.error('Failed to fetch installed models:', error);
  } finally {
    loading.value = false;
  }
}

async function pullModel(modelId: string) {
  pullingModels.value[modelId] = true;

  // Show progress dialog
  pullProgress.value = {
    show: true,
    modelName: modelId,
    status: 'Connecting...',
    percentage: 0,
    total: 0,
    completed: 0,
  };

  try {
    // Construct SSE URL - use window.location.origin for proper absolute URL
    const sseUrl = `${window.location.origin}/api/admin/models/pull/stream/${encodeURIComponent(modelId)}`;
    console.log('Connecting to SSE:', sseUrl);

    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Progress update:', data); // Debug logging

        if (data.type === 'connected') {
          pullProgress.value.status = 'Starting download...';
        } else if (data.type === 'progress') {
          pullProgress.value.status = data.status || 'Downloading...';
          pullProgress.value.percentage = data.percentage ?? 0;
          pullProgress.value.total = data.total ?? 0;
          pullProgress.value.completed = data.completed ?? 0;
        } else if (data.type === 'complete') {
          eventSource.close();
          pullProgress.value.show = false;
          pullingModels.value[modelId] = false;

          $q.notify({
            type: 'positive',
            message: `${modelId} installed successfully!`,
            timeout: 3000,
          });

          // Refresh installed models
          await refreshInstalledModels();
        } else if (data.type === 'error') {
          eventSource.close();
          pullProgress.value.show = false;
          pullingModels.value[modelId] = false;

          $q.notify({
            type: 'negative',
            message: 'Failed to pull model',
            caption: data.error || 'Unknown error',
            timeout: 5000,
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      pullProgress.value.show = false;
      pullingModels.value[modelId] = false;

      $q.notify({
        type: 'negative',
        message: 'Connection error',
        caption: 'Failed to stream progress from server',
        timeout: 5000,
      });
    };
  } catch (error: any) {
    console.error('Failed to pull model:', error);
    pullProgress.value.show = false;
    pullingModels.value[modelId] = false;

    $q.notify({
      type: 'negative',
      message: 'Failed to pull model',
      caption: error.message || 'Unknown error',
      timeout: 5000,
    });
  }
}

async function testModel(modelName: string) {
  $q.loading.show({ message: `Testing ${modelName}...` });

  try {
    const response = await api.post('/api/admin/models/test', {
      modelName,
    });

    if (response.data.success) {
      $q.notify({
        type: 'positive',
        message: 'Model test successful!',
        caption: response.data.data.testResponse,
        timeout: 5000,
      });
    }
  } catch (error: any) {
    $q.notify({
      type: 'negative',
      message: 'Model test failed',
      caption: error.response?.data?.message || 'Unknown error',
      timeout: 5000,
    });
  } finally {
    $q.loading.hide();
  }
}

function isInstalled(modelId: string): boolean {
  // Normalize model names for comparison (remove :latest suffix if present)
  const normalizeModelName = (name: string) => {
    return name.replace(':latest', '').toLowerCase();
  };

  const normalizedId = normalizeModelName(modelId);

  return installedModels.value.some((m) => {
    const normalizedInstalled = normalizeModelName(m.name);
    // Check if names match exactly or if one starts with the other
    return normalizedInstalled === normalizedId ||
           normalizedInstalled.startsWith(normalizedId + ':') ||
           normalizedId.startsWith(normalizedInstalled + ':');
  });
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)}GB`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatStatus(status: string): string {
  // Make status messages more user-friendly
  const statusMap: Record<string, string> = {
    'pulling manifest': 'Retrieving model information...',
    'verifying sha256 digest': 'Verifying download integrity...',
    'writing manifest': 'Finalizing installation...',
    'removing any unused layers': 'Cleaning up...',
    'success': 'Download complete!',
  };

  // Check if it's a downloading status
  if (status.includes('downloading')) {
    return 'Downloading model files...';
  }

  return statusMap[status.toLowerCase()] || status;
}

function getSpeedColor(speed: string): string {
  const colors: Record<string, string> = {
    'Very Fast': 'positive',
    Fast: 'primary',
    Medium: 'orange',
    Slow: 'warning',
  };
  return colors[speed] || 'grey';
}
</script>

<style scoped lang="scss">
.model-management-page {
  background: #f5f5f5;
  min-height: 100vh;
}

.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;

  h4 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #2c3e50;
  }
}

.filter-card {
  border-radius: 8px;
}

.model-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.installed-model {
    border-left: 4px solid #21ba45;
  }

  &.available-model {
    border-left: 4px solid #2185d0;
  }
}

.model-details {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.quality-rating {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
