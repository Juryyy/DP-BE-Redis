<template>
  <q-stepper
    :model-value="currentStep"
    ref="stepper"
    color="primary"
    animated
    flat
    header-nav
    @update:model-value="$emit('update:current-step', $event)"
  >
    <q-step
      :name="1"
      title="Upload Files"
      icon="cloud_upload"
      :done="currentStep > 1"
    >
      <slot name="step1" />
    </q-step>

    <q-step
      :name="2"
      title="Select AI Model"
      icon="psychology"
      :done="currentStep > 2"
    >
      <slot name="step2" />
    </q-step>

    <q-step
      :name="3"
      title="Set AI Prompt"
      icon="edit_note"
      :done="currentStep > 3"
    >
      <slot name="step3" />
    </q-step>

    <q-step
      :name="4"
      title="Processing Options"
      icon="settings"
      :done="currentStep > 4"
    >
      <slot name="step4" />
    </q-step>

    <template #navigation>
      <q-stepper-navigation>
        <q-btn
          v-if="currentStep > 1"
          flat
          color="primary"
          label="Back"
          class="q-ml-sm"
          @click="$emit('back')"
        />
        <q-btn
          v-if="currentStep < 4"
          color="primary"
          :label="'Continue'"
          :disable="!canContinue"
          @click="$emit('next')"
        />
        <q-btn
          v-else
          color="positive"
          label="Start Processing"
          icon-right="play_arrow"
          :loading="isProcessing"
          @click="$emit('process')"
        />
      </q-stepper-navigation>
    </template>
  </q-stepper>
</template>

<script setup lang="ts">
defineProps<{
  currentStep: number;
  canContinue: boolean;
  isProcessing: boolean;
}>();

defineEmits<{
  (e: 'back'): void;
  (e: 'next'): void;
  (e: 'process'): void;
  (e: 'update:current-step', value: number): void;
}>();
</script>
