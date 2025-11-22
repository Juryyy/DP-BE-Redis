<template>
  <div class="results-step">
    <div v-if="isProcessing" class="text-center q-py-xl">
      <q-spinner-dots size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Processing your documents...</div>
      <div class="text-grey-6">This may take a few minutes</div>
    </div>

    <div v-else>
      <div class="text-h6 q-mb-md">Processing Complete!</div>

      <q-list bordered separator>
        <q-item v-for="result in props.processingResults" :key="result.model">
          <q-item-section avatar>
            <q-icon
              :name="result.success ? 'check_circle' : 'error'"
              :color="result.success ? 'green' : 'red'"
            />
          </q-item-section>

          <q-item-section>
            <q-item-label>{{ result.model }}</q-item-label>
            <q-item-label caption>{{ result.message }}</q-item-label>
            <q-item-label v-if="result.outputPath" caption>{{ result.outputPath }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div class="q-mt-lg text-center">
        <q-btn
          color="primary"
          label="Start New Processing"
          icon="refresh"
          @click="emit('restart')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  processingResults: any[];
  isProcessing: boolean;
}>();

const emit = defineEmits<{
  restart: [];
}>();
</script>
