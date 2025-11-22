<template>
  <div class="processing-status">
    <!-- Processing Header -->
    <div class="processing-header text-center q-mb-lg">
      <q-spinner-dots v-if="isProcessing" color="primary" size="4rem" class="q-mb-md" />
      <q-icon v-else-if="isCompleted" name="check_circle" size="4rem" color="positive" class="q-mb-md" />
      <q-icon v-else-if="isFailed" name="error" size="4rem" color="negative" class="q-mb-md" />
      <q-icon v-else name="pending" size="4rem" color="grey-5" class="q-mb-md" />

      <h5 class="text-grey-8 q-ma-none q-mb-sm">
        {{ statusTitle }}
      </h5>
      <p class="text-grey-6 q-ma-none">{{ statusMessage }}</p>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section q-mb-lg">
      <q-linear-progress
        :value="progress.percentage / 100"
        color="primary"
        size="12px"
        rounded
        class="q-mb-sm"
      />
      <div class="text-center text-grey-7">
        {{ progress.percentage }}% Complete
      </div>
    </div>

    <!-- Prompts Progress -->
    <div class="prompts-progress q-mb-lg">
      <div class="text-subtitle2 q-mb-md text-grey-8">Processing Prompts:</div>
      <div class="row q-col-gutter-md">
        <div class="col-6 col-sm-3">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-h6 text-positive">{{ progress.completed }}</div>
              <div class="text-caption text-grey-6">Completed</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-6 col-sm-3">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-h6 text-info">{{ progress.processing }}</div>
              <div class="text-caption text-grey-6">Processing</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-6 col-sm-3">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-h6 text-grey-7">{{ progress.pending }}</div>
              <div class="text-caption text-grey-6">Pending</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-6 col-sm-3">
          <q-card flat bordered>
            <q-card-section class="text-center">
              <div class="text-h6 text-negative">{{ progress.failed }}</div>
              <div class="text-caption text-grey-6">Failed</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Clarifications Alert -->
    <div v-if="hasClarifications" class="clarifications-alert q-mb-lg">
      <q-banner class="bg-orange-1 rounded-borders">
        <template #avatar>
          <q-icon name="help_outline" color="orange" size="lg" />
        </template>
        <div class="text-body2">
          <strong>Action Required:</strong> The AI needs clarification on
          {{ clarifications.length }} question(s). Please provide answers to continue processing.
        </div>
      </q-banner>
    </div>

    <!-- Session Info -->
    <div class="session-info q-mt-lg">
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Session Information</div>
          <div class="info-row">
            <span class="text-grey-7">Session ID:</span>
            <span class="text-grey-9 text-weight-medium">{{ sessionId }}</span>
          </div>
          <div class="info-row">
            <span class="text-grey-7">Status:</span>
            <q-chip :color="getStatusColor(status)" text-color="white" size="sm">
              {{ status }}
            </q-chip>
          </div>
          <div v-if="expiresAt" class="info-row">
            <span class="text-grey-7">Expires At:</span>
            <span class="text-grey-9">{{ formatDate(expiresAt) }}</span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWizardStore } from 'src/stores/wizard.store';
import type { SessionStatus } from 'src/types/api.types';

const wizardStore = useWizardStore();

// Computed
const sessionId = computed(() => wizardStore.sessionId || 'N/A');
const status = computed(() => wizardStore.sessionStatus);
const progress = computed(() => wizardStore.progress);
const clarifications = computed(() => wizardStore.clarifications);
const hasClarifications = computed(() => wizardStore.hasClarifications);
const expiresAt = computed(() => wizardStore.sessionExpiresAt);

const isProcessing = computed(() => wizardStore.isProcessing);
const isCompleted = computed(() => wizardStore.isCompleted);
const isFailed = computed(() => status.value === 'FAILED');

const statusTitle = computed(() => {
  switch (status.value) {
    case 'ACTIVE':
      return 'Session Active';
    case 'PROCESSING':
      return 'Processing Your Documents';
    case 'COMPLETED':
      return 'Processing Complete!';
    case 'FAILED':
      return 'Processing Failed';
    case 'EXPIRED':
      return 'Session Expired';
    default:
      return 'Unknown Status';
  }
});

const statusMessage = computed(() => {
  switch (status.value) {
    case 'ACTIVE':
      return 'Session is ready. Waiting for prompts...';
    case 'PROCESSING':
      return 'The AI is processing your documents. This may take a few moments.';
    case 'COMPLETED':
      return 'All prompts have been processed successfully!';
    case 'FAILED':
      return 'Something went wrong during processing. Please try again.';
    case 'EXPIRED':
      return 'Your session has expired. Please start a new session.';
    default:
      return '';
  }
});

// Methods
function getStatusColor(status: SessionStatus): string {
  const colors: Record<SessionStatus, string> = {
    ACTIVE: 'blue',
    PROCESSING: 'orange',
    COMPLETED: 'positive',
    FAILED: 'negative',
    EXPIRED: 'grey',
  };
  return colors[status] || 'grey';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}
</script>

<style lang="scss" scoped>
.processing-status {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.processing-header {
  padding: 2rem 0;
}

.progress-section {
  .q-linear-progress {
    height: 12px;
  }
}

.prompts-progress {
  .q-card {
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}

.clarifications-alert {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.9;
  }
}

.session-info {
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }
}

@media (max-width: 600px) {
  .processing-header {
    padding: 1rem 0;

    h5 {
      font-size: 1.2rem;
    }
  }
}
</style>
