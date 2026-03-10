<template>
  <div class="format-selector">
    <label class="format-selector_label">{{ t('format.label') }}</label>
    <div class="format-selector_options">
      <button
        v-for="fmt in formats"
        :key="fmt"
        class="format-selector_option"
        :class="{ 'format-selector_option_active': modelValue === fmt }"
        :disabled="disabled"
        @click="$emit('update:modelValue', fmt)"
      >
        {{ t(`format.${fmt}`) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n'

const formats = ['mp3', 'wav'] as const

defineProps<{
  modelValue: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
</script>

<style lang="scss" scoped>
@use '../assets/variables' as *;

.format-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &_label {
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  &_options {
    display: flex;
    gap: 8px;
  }

  &_option {
    flex: 1;
    padding: 8px 16px;
    background: $bg-input;
    color: $text-secondary;
    border: 1px solid $border;
    border-radius: $radius-sm;
    font-size: 13px;
    font-weight: 600;
    font-family: $font-family;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover:not(:disabled) {
      background: $bg-hover;
      color: $text-primary;
    }

    &_active {
      background: $accent-subtle;
      color: $accent;
      border-color: $accent;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
