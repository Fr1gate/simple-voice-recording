<template>
  <div class="device-selector">
    <label class="device-selector_label">{{ t('device.label') }}</label>
    <select
      class="device-selector_select"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="devices.length === 0" value="" disabled>{{ t('device.none') }}</option>
      <option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">
        {{
          device.label ||
            t('device.defaultName', {
              id: device.deviceId.slice(0, 8)
            })
        }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '../i18n'

defineProps<{
  modelValue: string
  devices: MediaDeviceInfo[]
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
</script>

<style lang="scss" scoped>
@use 'sass:color';
@use '../assets/variables' as *;

.device-selector {
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

  &_select {
    width: 100%;
    padding: 10px 12px;
    background: $bg-input;
    color: $text-primary;
    border: 1px solid $border;
    border-radius: $radius-sm;
    font-size: 13px;
    font-family: $font-family;
    cursor: pointer;
    transition: border-color $transition-fast;
    appearance: none;
    outline: none;

    &:focus {
      border-color: $border-focus;
    }

    &:hover:not(:disabled) {
      border-color: color.adjust($border, $lightness: 8%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    option {
      background: $bg-secondary;
      color: $text-primary;
    }
  }
}
</style>
