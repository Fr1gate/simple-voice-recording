<template>
  <div class="save-path">
    <label class="save-path_label">{{ t('savePath.label') }}</label>
    <div class="save-path_field">
      <input
        class="save-path_input"
        type="text"
        :value="modelValue"
        readonly
        :placeholder="t('savePath.placeholder')"
      />
      <button class="save-path_browse" :disabled="disabled" @click="browse">
        {{ t('savePath.browse') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n'

const props = defineProps<{
  modelValue: string
  format: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

async function browse(): Promise<void> {
  const path = await window.api.selectSavePath(props.format)
  if (path) emit('update:modelValue', path)
}
</script>

<style lang="scss" scoped>
@use 'sass:color';
@use '../assets/variables' as *;

.save-path {
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

  &_field {
    display: flex;
    gap: 8px;
  }

  &_input {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    background: $bg-input;
    color: $text-primary;
    border: 1px solid $border;
    border-radius: $radius-sm;
    font-size: 13px;
    font-family: $font-family;
    cursor: default;
    outline: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    direction: rtl;
    text-align: left;

    &::placeholder {
      color: $text-muted;
      direction: ltr;
    }
  }

  &_browse {
    padding: 10px 16px;
    background: $bg-hover;
    color: $text-primary;
    border: 1px solid $border;
    border-radius: $radius-sm;
    font-size: 13px;
    font-family: $font-family;
    cursor: pointer;
    white-space: nowrap;
    transition: all $transition-fast;

    &:hover:not(:disabled) {
      background: color.adjust($bg-hover, $lightness: 5%);
      border-color: color.adjust($border, $lightness: 8%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
