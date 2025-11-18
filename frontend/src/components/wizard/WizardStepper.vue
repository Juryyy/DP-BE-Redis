<template>
  <div class="modern-wizard">
    <!-- Step Progress Indicator -->
    <div class="step-progress">
      <div
        v-for="step in steps"
        :key="step.value"
        class="step-item"
        :class="{
          'step-active': currentStep === step.value,
          'step-completed': currentStep > step.value,
          'step-pending': currentStep < step.value
        }"
        @click="currentStep > step.value && $emit('update:current-step', step.value)"
      >
        <div class="step-circle">
          <q-icon v-if="currentStep > step.value" name="check" size="24px" />
          <span v-else>{{ step.value }}</span>
        </div>
        <div class="step-info">
          <div class="step-label">{{ step.label }}</div>
          <div class="step-icon">
            <q-icon :name="step.icon" size="20px" />
          </div>
        </div>
        <div v-if="step.value < 4" class="step-connector"></div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="step-content">
      <transition :name="transitionName" mode="out-in">
        <div :key="currentStep" class="content-wrapper">
          <slot v-if="currentStep === 1" name="step1" />
          <slot v-if="currentStep === 2" name="step2" />
          <slot v-if="currentStep === 3" name="step3" />
          <slot v-if="currentStep === 4" name="step4" />
        </div>
      </transition>
    </div>

    <!-- Navigation -->
    <div class="step-navigation">
      <q-btn
        v-if="currentStep > 1"
        outline
        color="primary"
        label="Back"
        icon="arrow_back"
        size="sm"
        class="nav-button"
        @click="$emit('back')"
      />
      <q-space />
      <q-btn
        v-if="currentStep < 4"
        unelevated
        color="primary"
        :label="currentStep === 3 ? 'Review & Continue' : 'Continue'"
        icon-right="arrow_forward"
        size="sm"
        :disable="!canContinue"
        class="nav-button"
        @click="$emit('next')"
      />
      <q-btn
        v-else
        unelevated
        :color="isProcessing ? 'grey' : 'positive'"
        label="Start Processing"
        icon-right="rocket_launch"
        size="sm"
        :loading="isProcessing"
        :disable="!canContinue"
        class="nav-button process-button"
        @click="$emit('process')"
      >
        <template #loading>
          <q-spinner-hourglass size="20px" />
        </template>
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
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

const steps = [
  { value: 1, label: 'Upload Files', icon: 'cloud_upload' },
  { value: 2, label: 'Select AI Models', icon: 'psychology' },
  { value: 3, label: 'Configure Prompt', icon: 'edit_note' },
  { value: 4, label: 'Review & Process', icon: 'rocket_launch' }
];

const transitionName = ref('slide-left');
const previousStep = ref(props.currentStep);

watch(() => props.currentStep, (newVal, oldVal) => {
  transitionName.value = newVal > oldVal ? 'slide-left' : 'slide-right';
  previousStep.value = oldVal;
});
</script>

<style scoped lang="scss">
.modern-wizard {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  padding: 2rem;
}

/* Step Progress */
.step-progress {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  padding: 1rem 0;
}

.step-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  cursor: default;
  transition: all 0.3s ease;
}

.step-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  position: relative;
  z-index: 2;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.step-pending .step-circle {
  background: #e2e8f0;
  color: #a0aec0;
  border: 3px solid #cbd5e0;
}

.step-active .step-circle {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: 3px solid #667eea;
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7),
                0 4px 12px rgba(0, 0, 0, 0.15);
  }
  50% {
    box-shadow: 0 0 0 12px rgba(102, 126, 234, 0),
                0 4px 12px rgba(0, 0, 0, 0.15);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0),
                0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.step-completed .step-circle {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  border: 3px solid #48bb78;
  cursor: pointer;
  animation: checkmark-pop 0.4s ease;
}

@keyframes checkmark-pop {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.step-completed .step-circle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
}

.step-info {
  margin-top: 1rem;
  text-align: center;
  min-height: 60px;
}

.step-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
}

.step-pending .step-label {
  color: #a0aec0;
}

.step-active .step-label {
  color: #667eea;
}

.step-completed .step-label {
  color: #38a169;
}

.step-icon {
  color: #a0aec0;
  transition: color 0.3s ease;
}

.step-active .step-icon {
  color: #667eea;
}

.step-completed .step-icon {
  color: #38a169;
}

.step-connector {
  position: absolute;
  top: 30px;
  left: calc(50% + 30px);
  right: calc(-50% + 30px);
  height: 4px;
  background: #e2e8f0;
  z-index: 1;
  transition: all 0.6s ease;
}

.step-completed .step-connector {
  background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
  animation: connector-fill 0.6s ease;
}

@keyframes connector-fill {
  from {
    transform: scaleX(0);
    transform-origin: left;
  }
  to {
    transform: scaleX(1);
    transform-origin: left;
  }
}

/* Step Content */
.step-content {
  position: relative;
  min-height: 500px;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  border: 2px solid #e2e8f0;
}

.content-wrapper {
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* Navigation */
.step-navigation {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-radius: 16px;
  border: 2px solid #e2e8f0;
}

.nav-button {
  min-width: 150px;
  padding: 0.75rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  font-size: 1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.nav-button:active:not(:disabled) {
  transform: translateY(0);
}

.process-button {
  animation: pulse-glow 2s ease infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(72, 187, 120, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(72, 187, 120, 0.6);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modern-wizard {
    padding: 1rem;
    gap: 1.5rem;
  }

  .step-progress {
    flex-direction: column;
    gap: 1.5rem;
  }

  .step-item {
    width: 100%;
    flex-direction: row;
    justify-content: flex-start;
    padding-left: 1rem;
  }

  .step-circle {
    width: 50px;
    height: 50px;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .step-info {
    margin-top: 0;
    margin-left: 1rem;
    text-align: left;
    min-height: auto;
    flex: 1;
  }

  .step-connector {
    display: none;
  }

  .step-content {
    padding: 1rem;
    min-height: 400px;
  }

  .step-navigation {
    flex-wrap: wrap;
    padding: 1rem;
  }

  .nav-button {
    min-width: 120px;
    flex: 1;
  }
}
</style>
