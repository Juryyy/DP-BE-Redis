<template>
  <div class="clarification-step">
    <!-- Header -->
    <div class="clarification-header q-mb-lg text-center">
      <q-icon name="help_outline" size="4rem" color="orange" class="q-mb-md" />
      <h5 class="text-grey-8 q-ma-none q-mb-sm">AI Needs Clarification</h5>
      <p class="text-grey-6 q-ma-none">
        The AI has encountered some uncertainties and needs your input to continue processing.
      </p>
    </div>

    <!-- Clarifications List -->
    <div v-if="clarifications.length > 0" class="clarifications-list">
      <div
        v-for="(clarification, index) in clarifications"
        :key="clarification.id"
        class="clarification-item q-mb-lg"
      >
        <q-card bordered>
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="smart_toy" color="orange" size="sm" class="q-mr-sm" />
              <div class="text-subtitle2 text-weight-medium">
                Question #{{ index + 1 }}
              </div>
              <q-space />
              <q-chip size="sm" color="orange" text-color="white">
                {{ clarification.type }}
              </q-chip>
            </div>

            <div class="question-content q-mb-md">
              <q-banner class="bg-orange-1 text-grey-8 rounded-borders">
                <template #avatar>
                  <q-icon name="question_mark" color="orange" />
                </template>
                {{ clarification.content }}
              </q-banner>
            </div>

            <!-- Context (if available) -->
            <div v-if="clarification.context" class="clarification-context q-mb-md">
              <div class="text-caption text-grey-6 q-mb-xs">Context:</div>
              <q-card flat bordered class="bg-grey-1">
                <q-card-section class="q-pa-sm">
                  <pre class="context-data">{{ JSON.stringify(clarification.context, null, 2) }}</pre>
                </q-card-section>
              </q-card>
            </div>

            <!-- Response Input -->
            <div class="response-input">
              <q-input
                v-model="responses[clarification.id]"
                type="textarea"
                label="Your Response *"
                hint="Provide a clear answer to help the AI continue"
                rows="3"
                outlined
                :rules="[(val: string) => !!val || 'Response is required']"
              />
            </div>

            <!-- Submit Button -->
            <div class="text-right q-mt-md">
              <q-btn
                color="primary"
                label="Submit Answer"
                icon-right="send"
                @click="submitResponse(clarification.id)"
                :loading="loadingStates[clarification.id]"
                :disable="!responses[clarification.id] || loadingStates[clarification.id]"
                unelevated
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- No Clarifications State -->
    <div v-else class="no-clarifications text-center q-pa-xl">
      <q-icon name="check_circle" size="4rem" color="positive" class="q-mb-md" />
      <h6 class="text-grey-7 q-ma-none q-mb-sm">No Pending Clarifications</h6>
      <p class="text-grey-6 q-ma-none">
        All questions have been answered. Processing will continue automatically.
      </p>
    </div>

    <!-- Help Info -->
    <div class="help-info q-mt-lg">
      <q-banner class="bg-blue-1 rounded-borders">
        <template #avatar>
          <q-icon name="info" color="blue" />
        </template>
        <div class="text-body2">
          <strong>Tip:</strong> Be as specific as possible in your answers.
          The AI will use your responses to continue processing the documents accurately.
        </div>
      </q-banner>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useWizardStore } from 'src/stores/wizard.store';

const $q = useQuasar();
const wizardStore = useWizardStore();

// Local state
const responses = ref<Record<string, string>>({});
const loadingStates = ref<Record<string, boolean>>({});

// Computed
const clarifications = computed(() => wizardStore.clarifications);

// Methods
async function submitResponse(clarificationId: string) {
  const responseText = responses.value[clarificationId];

  if (!responseText) {
    $q.notify({
      type: 'warning',
      message: 'Please provide a response',
      icon: 'warning',
      position: 'top',
    });
    return;
  }

  try {
    loadingStates.value[clarificationId] = true;

    await wizardStore.respondToClarification(clarificationId, responseText);

    $q.notify({
      type: 'positive',
      message: 'Response submitted successfully!',
      icon: 'check_circle',
      position: 'top',
      timeout: 3000,
    });

    // Clear the response
    delete responses.value[clarificationId];
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Failed to submit response',
      icon: 'error',
      position: 'top',
      timeout: 5000,
    });
  } finally {
    loadingStates.value[clarificationId] = false;
  }
}

// Lifecycle
onMounted(async () => {
  // Fetch clarifications if needed
  if (clarifications.value.length === 0 && wizardStore.sessionId) {
    try {
      await wizardStore.fetchClarifications();
    } catch (error) {
      console.error('Failed to fetch clarifications:', error);
    }
  }
});
</script>

<style lang="scss" scoped>
.clarification-step {
  width: 100%;
}

.clarification-header {
  padding: 2rem 0;
}

.clarifications-list {
  max-width: 800px;
  margin: 0 auto;
}

.clarification-item {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.question-content {
  .q-banner {
    border-left: 4px solid #f57c00;
  }
}

.context-data {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  margin: 0;
  color: #424242;
  max-height: 200px;
  overflow: auto;
}

.no-clarifications {
  border: 2px dashed #e0e0e0;
  border-radius: 12px;
  background: #fafafa;
}

.help-info {
  max-width: 800px;
  margin: 0 auto;
}
</style>
