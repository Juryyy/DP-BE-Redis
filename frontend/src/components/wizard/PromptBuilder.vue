<template>
  <div class="prompt-builder">
    <!-- Prompt List Header -->
    <div class="prompts-header q-mb-md">
      <h6 class="text-grey-8 q-ma-none">Processing Prompts ({{ prompts.length }})</h6>
      <q-btn
        color="primary"
        label="Add Prompt"
        icon="add"
        @click="addNewPrompt"
        unelevated
        class="add-prompt-btn"
      />
    </div>

    <!-- No Prompts State -->
    <div v-if="prompts.length === 0" class="no-prompts q-pa-xl text-center">
      <q-icon name="post_add" size="4rem" color="grey-4" class="q-mb-md" />
      <p class="text-grey-6">No prompts added yet. Click "Add Prompt" to start.</p>
      <p class="text-caption text-grey-5">Or try one of the quick templates below</p>
    </div>

    <!-- Prompts List -->
    <div v-else class="prompts-list q-mb-lg">
      <q-expansion-item
        v-for="(prompt, index) in prompts"
        :key="index"
        :label="`Prompt #${index + 1} - Priority ${prompt.priority}`"
        :caption="prompt.content || 'Enter prompt content...'"
        expand-separator
        default-opened
        class="prompt-item q-mb-md"
      >
        <template #header>
          <q-item-section avatar>
            <q-icon
              :name="getPromptIcon(prompt.targetType)"
              :color="getPromptColor(prompt.targetType)"
              size="md"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              Prompt #{{ index + 1 }} - Priority {{ prompt.priority }}
            </q-item-label>
            <q-item-label caption class="ellipsis text-grey-7">
              {{ prompt.content || 'Enter prompt content...' }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-chip
              :color="getTargetTypeColor(prompt.targetType)"
              text-color="white"
              size="sm"
              class="target-chip"
            >
              {{ formatTargetType(prompt.targetType) }}
            </q-chip>
          </q-item-section>
        </template>

        <q-card flat bordered class="prompt-card">
          <q-card-section>
            <!-- Prompt Content -->
            <q-input
              v-model="prompt.content"
              type="textarea"
              label="Prompt Content *"
              hint="Describe what you want the AI to do"
              rows="3"
              outlined
              :rules="[(val: string) => !!val || 'Prompt content is required']"
              class="q-mb-md"
            />

            <div class="row q-col-gutter-md q-mb-md">
              <!-- Priority -->
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="prompt.priority"
                  type="number"
                  label="Priority *"
                  hint="Lower number = executes first"
                  outlined
                  min="0"
                  :rules="[(val: number) => val >= 0 || 'Priority must be >= 0']"
                />
              </div>

              <!-- Target Type -->
              <div class="col-12 col-sm-6">
                <q-select
                  v-model="prompt.targetType"
                  :options="targetTypeOptions"
                  label="Target Type *"
                  hint="Where to apply this prompt"
                  outlined
                  emit-value
                  map-options
                  @update:model-value="() => onTargetTypeChange(index)"
                />
              </div>
            </div>

            <!-- Target File (for FILE_SPECIFIC and LINE_SPECIFIC) -->
            <div
              v-if="prompt.targetType === 'FILE_SPECIFIC' || prompt.targetType === 'LINE_SPECIFIC'"
              class="q-mb-md"
            >
              <q-select
                v-model="prompt.targetFileId"
                :options="fileOptions"
                label="Target File *"
                hint="Select the file to process"
                outlined
                emit-value
                map-options
                :rules="[(val: string) => !!val || 'Target file is required']"
              >
                <template #prepend>
                  <q-icon name="description" color="primary" />
                </template>
              </q-select>
            </div>

            <!-- Target Lines (for LINE_SPECIFIC) -->
            <div v-if="prompt.targetType === 'LINE_SPECIFIC'" class="row q-col-gutter-md q-mb-md">
              <div class="col-6">
                <q-input
                  v-model.number="prompt.targetLines!.start"
                  type="number"
                  label="Start Line *"
                  outlined
                  min="1"
                  :rules="[(val: number) => val >= 1 || 'Start line must be >= 1']"
                >
                  <template #prepend>
                    <q-icon name="format_list_numbered" color="primary" />
                  </template>
                </q-input>
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="prompt.targetLines!.end"
                  type="number"
                  label="End Line *"
                  outlined
                  min="1"
                  :rules="[(val: number) => val >= 1 || 'End line must be >= 1']"
                >
                  <template #prepend>
                    <q-icon name="format_list_numbered" color="primary" />
                  </template>
                </q-input>
              </div>
            </div>

            <!-- Target Section (for SECTION_SPECIFIC) -->
            <div v-if="prompt.targetType === 'SECTION_SPECIFIC'" class="q-mb-md">
              <q-input
                v-model="prompt.targetSection"
                label="Target Section *"
                hint="Enter the section name (e.g., 'Q4 Revenue', 'Executive Summary')"
                outlined
                :rules="[(val: string) => !!val || 'Target section is required']"
              >
                <template #prepend>
                  <q-icon name="segment" color="primary" />
                </template>
              </q-input>
            </div>

            <!-- Actions -->
            <div class="text-right">
              <q-btn
                flat
                color="negative"
                label="Remove Prompt"
                icon="delete"
                @click="removePrompt(index)"
                size="sm"
              />
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </div>

    <!-- Quick Templates -->
    <div class="prompt-templates q-mt-lg">
      <div class="row items-center q-mb-md">
        <q-icon name="lightbulb" color="amber-7" size="sm" class="q-mr-sm" />
        <div class="text-subtitle2 text-grey-7">Quick Templates:</div>
      </div>
      <div class="row q-col-gutter-sm">
        <div
          class="col-12 col-sm-6 col-md-4"
          v-for="template in templates"
          :key="template.content"
        >
          <q-card
            flat
            bordered
            class="template-card cursor-pointer"
            @click="useTemplate(template)"
          >
            <q-card-section class="q-pa-md">
              <div class="row items-center q-mb-xs">
                <q-icon :name="template.icon" color="primary" size="sm" class="q-mr-sm" />
                <div class="text-body2 text-weight-medium ellipsis">
                  {{ template.content }}
                </div>
              </div>
              <div class="text-caption text-grey-6">{{ template.description }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWizardStore } from 'src/stores/wizard-store';
import type { PromptInput, TargetType } from 'src/types/wizard.types';

const wizardStore = useWizardStore();

// Local prompts state
const prompts = ref<PromptInput[]>([]);

// Computed - use FileMetadata from wizard store
const fileOptions = computed(() => {
  return wizardStore.uploadedFiles.map((file) => ({
    label: file.filename,
    value: file.id,
  }));
});

const targetTypeOptions = [
  { label: 'Global (All Files)', value: 'GLOBAL', icon: 'public' },
  { label: 'Specific File', value: 'FILE_SPECIFIC', icon: 'description' },
  { label: 'Line Range', value: 'LINE_SPECIFIC', icon: 'format_list_numbered' },
  { label: 'Section', value: 'SECTION_SPECIFIC', icon: 'segment' },
];

const templates = [
  {
    content: 'Summarize the key points from all documents',
    description: 'Create a concise summary',
    icon: 'summarize',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
  {
    content: 'Extract all dates, numbers, and financial data',
    description: 'Find important data points',
    icon: 'analytics',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
  {
    content: 'Create an executive summary',
    description: 'High-level overview',
    icon: 'article',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
  {
    content: 'Format as a professional report',
    description: 'Structured formatting',
    icon: 'description',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
  {
    content: 'Extract revenue and cost data',
    description: 'Financial information',
    icon: 'payments',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
  {
    content: 'Translate to English',
    description: 'Language translation',
    icon: 'translate',
    targetType: 'GLOBAL' as TargetType,
    priority: 1,
  },
];

// Methods
function addNewPrompt() {
  prompts.value.push({
    content: '',
    priority: prompts.value.length + 1,
    targetType: 'GLOBAL',
    targetLines: { start: 1, end: 10 },
  });
}

function removePrompt(index: number) {
  prompts.value.splice(index, 1);
  // Reorder priorities
  prompts.value.forEach((p, i) => {
    p.priority = i + 1;
  });
}

function onTargetTypeChange(index: number) {
  const prompt = prompts.value[index];
  if (!prompt) return;

  // Reset target-specific fields when type changes
  delete prompt.targetFileId;
  delete prompt.targetSection;

  // Initialize targetLines if LINE_SPECIFIC
  if (prompt.targetType === 'LINE_SPECIFIC') {
    prompt.targetLines = { start: 1, end: 10 };
  } else {
    delete prompt.targetLines;
  }
}

function useTemplate(template: (typeof templates)[0]) {
  prompts.value.push({
    content: template.content,
    priority: prompts.value.length + 1,
    targetType: template.targetType,
  });
}

function getPromptIcon(targetType: TargetType): string {
  const icons: Record<TargetType, string> = {
    GLOBAL: 'public',
    FILE_SPECIFIC: 'description',
    LINE_SPECIFIC: 'format_list_numbered',
    SECTION_SPECIFIC: 'segment',
  };
  return icons[targetType] || 'help';
}

function getPromptColor(targetType: TargetType): string {
  const colors: Record<TargetType, string> = {
    GLOBAL: 'blue-6',
    FILE_SPECIFIC: 'green-6',
    LINE_SPECIFIC: 'orange-6',
    SECTION_SPECIFIC: 'purple-6',
  };
  return colors[targetType] || 'grey';
}

function getTargetTypeColor(targetType: TargetType): string {
  const colors: Record<TargetType, string> = {
    GLOBAL: 'blue-6',
    FILE_SPECIFIC: 'green-6',
    LINE_SPECIFIC: 'orange-6',
    SECTION_SPECIFIC: 'purple-6',
  };
  return colors[targetType] || 'grey';
}

function formatTargetType(targetType: TargetType): string {
  const labels: Record<TargetType, string> = {
    GLOBAL: 'Global',
    FILE_SPECIFIC: 'File',
    LINE_SPECIFIC: 'Lines',
    SECTION_SPECIFIC: 'Section',
  };
  return labels[targetType] || targetType;
}

// Validation
function validate(): boolean {
  if (prompts.value.length === 0) return false;

  return prompts.value.every((p) => {
    const hasContent = !!p.content;
    const hasPriority = typeof p.priority === 'number' && p.priority >= 0;
    const hasTargetFile =
      p.targetType !== 'FILE_SPECIFIC' && p.targetType !== 'LINE_SPECIFIC'
        ? true
        : !!p.targetFileId;
    const hasTargetSection = p.targetType !== 'SECTION_SPECIFIC' ? true : !!p.targetSection;
    const hasValidLines =
      p.targetType !== 'LINE_SPECIFIC' ? true :
      !!(p.targetLines && p.targetLines.start >= 1 && p.targetLines.end >= p.targetLines.start);

    return hasContent && hasPriority && hasTargetFile && hasTargetSection && hasValidLines;
  });
}

function getPrompts(): PromptInput[] {
  return prompts.value;
}

// Expose for parent component
defineExpose({
  prompts,
  validate,
  getPrompts,
});
</script>

<style lang="scss" scoped>
.prompt-builder {
  width: 100%;
}

.prompts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;

  h6 {
    font-size: 1.25rem;
    color: #374151;
  }
}

.add-prompt-btn {
  font-weight: 600;
  padding: 0.5rem 1.5rem;
}

.no-prompts {
  border: 2px dashed #cbd5e0;
  border-radius: 12px;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
}

.prompts-list {
  .prompt-item {
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: white;
    transition: all 0.3s ease;

    &:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
    }
  }
}

.prompt-card {
  background: #fafafa;
  border: none;
}

.target-chip {
  font-weight: 600;
  font-size: 0.75rem;
}

.template-card {
  transition: all 0.2s ease;
  border: 2px solid #e2e8f0;
  background: white;

  &:hover {
    border-color: #3b82f6;
    background: #f0f9ff;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Responsive Design */
@media (max-width: 600px) {
  .prompts-header {
    flex-direction: column;
    align-items: stretch;

    .add-prompt-btn {
      width: 100%;
    }
  }

  .template-card {
    .text-body2 {
      font-size: 0.85rem;
    }
  }
}
</style>
