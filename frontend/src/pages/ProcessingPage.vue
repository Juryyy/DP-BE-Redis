<template>
  <q-page class="processing-page">
    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-content">
          <q-icon name="smart_toy" size="md" color="white" class="q-mr-sm" />
          <div>
            <div class="text-h6">AI Processing</div>
            <div class="text-caption">{{ statusText }}</div>
          </div>
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          color="white"
          @click="goBack"
        />
      </div>

      <!-- Chat Messages -->
      <div class="chat-messages" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message-wrapper"
          :class="message.type"
        >
          <q-card :class="['message-card', message.type]">
            <q-card-section>
              <!-- Message Header -->
              <div class="message-header">
                <q-avatar size="32px" :color="message.type === 'user' ? 'primary' : 'secondary'">
                  <q-icon
                    :name="message.type === 'user' ? 'person' : 'smart_toy'"
                    color="white"
                  />
                </q-avatar>
                <div class="message-meta">
                  <div class="message-sender">
                    {{ message.type === 'user' ? 'You' : message.model || 'AI' }}
                  </div>
                  <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                </div>
              </div>

              <!-- Message Content -->
              <div class="message-content">
                <div v-if="message.type === 'ai' && message.isHtml" v-html="message.content"></div>
                <div v-else class="message-text">{{ message.content }}</div>

                <!-- Loading indicator -->
                <div v-if="message.isLoading" class="loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>

              <!-- Message Footer (for AI responses) -->
              <div v-if="message.type === 'ai' && !message.isLoading" class="message-footer">
                <q-chip size="sm" outline v-if="message.duration">
                  <q-icon name="schedule" size="xs" class="q-mr-xs" />
                  {{ message.duration }}ms
                </q-chip>
                <q-chip size="sm" outline v-if="message.tokens">
                  <q-icon name="data_usage" size="xs" class="q-mr-xs" />
                  {{ message.tokens }} tokens
                </q-chip>
                <q-chip size="sm" :color="message.status === 'error' ? 'negative' : 'positive'" text-color="white">
                  {{ message.status || 'completed' }}
                </q-chip>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error-banner">
          <q-banner class="bg-negative text-white" rounded>
            <template #avatar>
              <q-icon name="error" size="md" />
            </template>
            {{ error }}
          </q-banner>
        </div>
      </div>

      <!-- Input Area (for future chat continuation) -->
      <div class="chat-input" v-if="canContinue">
        <q-input
          v-model="userInput"
          outlined
          placeholder="Continue the conversation..."
          @keyup.enter="sendMessage"
          class="input-field"
        >
          <template #append>
            <q-btn
              round
              dense
              flat
              icon="send"
              color="primary"
              @click="sendMessage"
              :disable="!userInput.trim()"
            />
          </template>
        </q-input>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useWizardStore } from 'src/stores/wizard-store';
import { api } from 'boot/axios';

const router = useRouter();
const wizardStore = useWizardStore();

interface Message {
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  duration?: number;
  tokens?: number;
  status?: string;
  isHtml?: boolean;
  isLoading?: boolean;
}

const messages = ref<Message[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const userInput = ref('');
const error = ref<string | null>(null);
const statusText = ref('Starting processing...');
const canContinue = ref(false);
const pollInterval = ref<NodeJS.Timeout | null>(null);

// Add initial user prompts as messages
onMounted(async () => {
  // Add user prompts to chat
  wizardStore.prompts.forEach((prompt) => {
    messages.value.push({
      type: 'user',
      content: prompt.content,
      timestamp: new Date(),
    });
  });

  // Add loading message
  messages.value.push({
    type: 'ai',
    content: 'Processing your request...',
    timestamp: new Date(),
    isLoading: true,
  });

  await scrollToBottom();

  // Start polling for status
  startPolling();
});

onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
  }
});

function startPolling() {
  // Poll every 1 second for status updates
  pollInterval.value = setInterval(async () => {
    await checkStatus();
  }, 1000);
}

async function checkStatus() {
  if (!wizardStore.sessionId) return;

  try {
    const response = await api.get(`/api/wizard/status/${wizardStore.sessionId}`);
    const data = response.data;

    if (data.success) {
      statusText.value = data.data.status;

      // Check if processing is complete
      if (data.data.status === 'COMPLETED' || data.data.status === 'FAILED') {
        if (pollInterval.value) {
          clearInterval(pollInterval.value);
          pollInterval.value = null;
        }

        // Remove loading message
        messages.value = messages.value.filter(m => !m.isLoading);

        // Fetch results
        await fetchResults();
      }
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

async function fetchResults() {
  if (!wizardStore.sessionId) return;

  try {
    const response = await api.get(`/api/wizard/result/${wizardStore.sessionId}`);
    const data = response.data;

    if (data.success && data.data) {
      // Add AI response messages
      if (Array.isArray(data.data.prompts)) {
        data.data.prompts.forEach((prompt: any) => {
          if (prompt.result) {
            messages.value.push({
              type: 'ai',
              content: prompt.result,
              timestamp: new Date(prompt.completedAt || Date.now()),
              model: 'AI Model',
              isHtml: false,
            });
          }
          if (prompt.error) {
            messages.value.push({
              type: 'system',
              content: `Error: ${prompt.error}`,
              timestamp: new Date(prompt.completedAt || Date.now()),
              status: 'error',
            });
          }
        });
      }

      statusText.value = 'Processing complete';
      canContinue.value = true;
      await scrollToBottom();
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to fetch results';
    statusText.value = 'Error occurred';
  }
}

function sendMessage() {
  if (!userInput.value.trim()) return;

  // Add user message
  messages.value.push({
    type: 'user',
    content: userInput.value,
    timestamp: new Date(),
  });

  userInput.value = '';
  scrollToBottom();

  // TODO: Send to backend for continuation
}

function formatTime(timestamp: Date): string {
  return new Date(timestamp).toLocaleTimeString();
}

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function goBack() {
  router.push('/');
}
</script>

<style scoped lang="scss">
.processing-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.chat-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  flex-shrink: 0;

  .header-content {
    display: flex;
    align-items: center;
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
}

.message-wrapper {
  display: flex;

  &.user {
    justify-content: flex-end;
  }

  &.ai, &.system {
    justify-content: flex-start;
  }
}

.message-card {
  max-width: 70%;
  animation: slideIn 0.3s ease;

  &.user {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  &.ai {
    background: white;
  }

  &.system {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.message-meta {
  display: flex;
  flex-direction: column;
}

.message-sender {
  font-weight: 600;
  font-size: 0.9rem;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
}

.message-content {
  margin-top: 0.5rem;
  line-height: 1.6;
}

.message-text {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.loading-dots {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }

    &:nth-child(2) {
      animation-delay: -0.16s;
    }
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.message-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.error-banner {
  margin-top: 1rem;
}

.chat-input {
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  flex-shrink: 0;

  .input-field {
    background: white;
    border-radius: 24px;
  }
}

@media (max-width: 768px) {
  .message-card {
    max-width: 85%;
  }
}
</style>
