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
                <!-- Render markdown for AI messages -->
                <div
                  v-if="message.type === 'ai' && !message.isLoading"
                  class="message-text markdown-content"
                  v-html="getRenderedMessage(message)"
                ></div>
                <!-- Plain text for user/system messages -->
                <div v-else-if="!message.isLoading" class="message-text">{{ message.content }}</div>

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
          :disable="isSendingMessage"
        >
          <template #append>
            <q-btn
              round
              dense
              flat
              icon="send"
              color="primary"
              @click="sendMessage"
              :disable="!userInput.trim() || isSendingMessage"
              :loading="isSendingMessage"
            />
          </template>
        </q-input>
      </div>
    </div>

    <!-- Model Selection Dialog -->
    <q-dialog v-model="showModelSelector" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">
            <q-icon name="psychology" class="q-mr-sm" />
            Select Models for Response
          </div>
          <div class="text-caption">Choose which AI models should respond to your message</div>
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md text-body2 text-grey-7">
            Select one or more models to get different perspectives:
          </div>

          <!-- Available models from wizard store -->
          <q-list>
            <q-item
              v-for="model in wizardStore.selectedModels"
              :key="`${model.provider}-${model.model}`"
              tag="label"
              clickable
            >
              <q-item-section avatar>
                <q-checkbox
                  v-model="selectedChatModels"
                  :val="{ provider: model.provider, model: model.model, enabled: true }"
                  color="primary"
                />
              </q-item-section>

              <q-item-section avatar>
                <q-avatar :color="getProviderColor(model.provider)" text-color="white" size="sm">
                  <q-icon :name="getProviderIcon(model.provider)" />
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label>{{ model.model }}</q-item-label>
                <q-item-label caption>{{ getProviderLabel(model.provider) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-banner v-if="selectedChatModels.length === 0" class="bg-warning text-white q-mt-md" rounded>
            <template #avatar>
              <q-icon name="warning" />
            </template>
            Please select at least one model
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup @click="userInput = ''" />
          <q-btn
            unelevated
            label="Send to Selected Models"
            color="primary"
            icon="send"
            @click="sendWithSelectedModels"
            :disable="selectedChatModels.length === 0"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useWizardStore } from 'src/stores/wizard-store';
import { api } from 'boot/axios';
import { useMarkdown } from 'src/composables/useMarkdown';
import 'highlight.js/styles/github-dark.css'; // Syntax highlighting theme

const router = useRouter();
const wizardStore = useWizardStore();
const { renderMarkdown, hasMarkdown } = useMarkdown();

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

// Model selection for chat continuation
const showModelSelector = ref(false);
const selectedChatModels = ref<any[]>([]);
const isSendingMessage = ref(false);

// Multi-model responses
interface MultiModelResponse {
  provider: string;
  modelName: string;
  status: string;
  result: string;
  error?: string;
  duration: number;
  tokensUsed?: number;
}

const latestResponses = ref<MultiModelResponse[]>([]);
const selectedResponseIndices = ref<Set<number>>(new Set());

// Render markdown for messages
const getRenderedMessage = (message: Message): string => {
  if (message.type === 'ai' && hasMarkdown(message.content)) {
    return renderMarkdown(message.content);
  }
  return message.content;
};

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
  // Poll every 2 seconds for status updates (reduce backend load)
  pollInterval.value = setInterval(async () => {
    await checkStatus();
  }, 2000);
}

async function checkStatus() {
  if (!wizardStore.sessionId) return;

  try {
    const response = await api.get(`/api/wizard/status/${wizardStore.sessionId}`);
    const data = response.data;

    console.log('Status response:', data);

    if (data.success) {
      statusText.value = data.data.status;
      console.log('Session status:', data.data.status, 'Progress:', data.data.progress);

      // Check if processing is complete
      if (data.data.status === 'COMPLETED' || data.data.status === 'FAILED') {
        console.log('Processing complete, stopping poll and fetching results...');

        if (pollInterval.value) {
          clearInterval(pollInterval.value);
          pollInterval.value = null;
        }

        // Remove loading message
        const beforeCount = messages.value.length;
        messages.value = messages.value.filter(m => !m.isLoading);
        console.log(`Removed loading messages: ${beforeCount} -> ${messages.value.length}`);

        // Fetch results
        console.log('Calling fetchResults()...');
        await fetchResults();
        console.log('fetchResults() completed, message count:', messages.value.length);
      }
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

async function fetchResults() {
  if (!wizardStore.sessionId) {
    console.warn('fetchResults: No sessionId available');
    return;
  }

  console.log('fetchResults: Fetching results for session:', wizardStore.sessionId);

  try {
    const response = await api.get(`/api/wizard/result/${wizardStore.sessionId}`);
    const data = response.data;

    console.log('fetchResults: Full response:', JSON.stringify(data, null, 2));
    console.log('fetchResults: data.success:', data.success);
    console.log('fetchResults: data.data:', data.data);

    if (data.success && data.data) {
      console.log('fetchResults: Checking result format...');
      console.log('fetchResults: data.data.result exists?', !!data.data.result);
      console.log('fetchResults: data.data.result.content exists?', !!(data.data.result && data.data.result.content));

      // Handle new result format (combined result)
      if (data.data.result && data.data.result.content) {
        console.log('fetchResults: Adding AI message with content length:', data.data.result.content.length);
        const newMessage = {
          type: 'ai' as const,
          content: data.data.result.content,
          timestamp: new Date(data.data.result.createdAt || Date.now()),
          model: 'AI Model',
          isHtml: false,
        };
        console.log('fetchResults: New message object:', newMessage);
        messages.value.push(newMessage);
        console.log('fetchResults: Message added. Total messages:', messages.value.length);
      }
      // Handle legacy format (individual prompts) - fallback
      else if (Array.isArray(data.data.prompts)) {
        console.log('fetchResults: Using legacy format, prompts count:', data.data.prompts.length);
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
        console.log('fetchResults: Added legacy messages. Total messages:', messages.value.length);
      } else {
        console.warn('fetchResults: No results found in response. Keys in data.data:', Object.keys(data.data));
      }

      statusText.value = 'Processing complete';
      canContinue.value = true;
      console.log('fetchResults: Current messages array:', messages.value);
      console.log('fetchResults: Messages is reactive?', messages.value.length);
      console.log('fetchResults: Scrolling to bottom...');
      await scrollToBottom();
      console.log('fetchResults: Complete');

      // Force reactivity trigger
      await nextTick();
      console.log('fetchResults: After nextTick, messages count:', messages.value.length);
    } else {
      console.warn('fetchResults: Response not successful or no data');
    }
  } catch (err: any) {
    console.error('fetchResults: Error:', err);
    console.error('fetchResults: Error response:', err.response);
    error.value = err.response?.data?.error || 'Failed to fetch results';
    statusText.value = 'Error occurred';
  }
}

function sendMessage() {
  if (!userInput.value.trim()) return;

  // Show model selection dialog
  showModelSelector.value = true;
}

async function sendWithSelectedModels() {
  if (!userInput.value.trim() || selectedChatModels.value.length === 0) return;

  const messageContent = userInput.value;
  showModelSelector.value = false;
  isSendingMessage.value = true;

  // Add user message to chat
  messages.value.push({
    type: 'user',
    content: messageContent,
    timestamp: new Date(),
  });

  userInput.value = '';

  // Add loading message
  messages.value.push({
    type: 'ai',
    content: `Processing with ${selectedChatModels.value.length} model(s)...`,
    timestamp: new Date(),
    isLoading: true,
  });

  await scrollToBottom();

  try {
    // Call continuation API
    const response = await api.post(`/api/wizard/conversation/${wizardStore.sessionId}/continue`, {
      message: messageContent,
      models: selectedChatModels.value,
      systemPrompt: 'You are a helpful AI assistant analyzing documents.',
    });

    // Remove loading message
    messages.value = messages.value.filter((m) => !m.isLoading);

    if (response.data.success) {
      latestResponses.value = response.data.data.responses;
      selectedResponseIndices.value.clear();

      // Show context warnings if any
      if (response.data.data.contextWarnings && response.data.data.contextWarnings.length > 0) {
        messages.value.push({
          type: 'system',
          content: `⚠️ Context Window Warnings:\n${response.data.data.contextWarnings.join('\n')}`,
          timestamp: new Date(),
          status: 'warning',
        });
      }

      // Add all successful responses to chat
      response.data.data.responses.forEach((resp: MultiModelResponse) => {
        if (resp.status === 'completed') {
          messages.value.push({
            type: 'ai',
            content: resp.result,
            timestamp: new Date(),
            model: `${resp.provider} (${resp.modelName})`,
            duration: resp.duration,
            tokens: resp.tokensUsed,
          });
        } else {
          messages.value.push({
            type: 'system',
            content: `❌ Error from ${resp.provider} (${resp.modelName}): ${resp.error}`,
            timestamp: new Date(),
            status: 'error',
          });
        }
      });

      await scrollToBottom();
      statusText.value = `Received ${response.data.data.successCount} response(s)`;
    }
  } catch (err: any) {
    // Remove loading message
    messages.value = messages.value.filter((m) => !m.isLoading);

    error.value = err.response?.data?.error || 'Failed to send message';
    messages.value.push({
      type: 'system',
      content: `Error: ${error.value}`,
      timestamp: new Date(),
      status: 'error',
    });
  } finally {
    isSendingMessage.value = false;
  }
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

/* Markdown Content Styling */
.markdown-content {
  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
  }

  :deep(h1) { font-size: 1.75rem; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem; }
  :deep(h2) { font-size: 1.5rem; border-bottom: 1px solid #e9ecef; padding-bottom: 0.4rem; }
  :deep(h3) { font-size: 1.25rem; }
  :deep(h4) { font-size: 1.1rem; }

  :deep(p) {
    margin-bottom: 1rem;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow-x: auto;
    display: block;
  }

  :deep(thead) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  :deep(th) {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  :deep(td) {
    padding: 0.75rem 1rem;
    border: 1px solid #dee2e6;
  }

  :deep(tbody tr:nth-child(even)) {
    background-color: #f8f9fa;
  }

  :deep(tbody tr:hover) {
    background-color: #e9ecef;
  }

  :deep(code) {
    background: #f4f4f4;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: #c7254e;
  }

  :deep(pre) {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    margin: 1rem 0;
  }

  :deep(pre code) {
    background: none;
    color: inherit;
    padding: 0;
  }

  :deep(ul), :deep(ol) {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
  }

  :deep(li) {
    margin-bottom: 0.5rem;
  }

  :deep(blockquote) {
    border-left: 4px solid #667eea;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #6c757d;
    font-style: italic;
  }

  :deep(a) {
    color: #667eea;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
