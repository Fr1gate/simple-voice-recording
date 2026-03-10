<template>
  <div class="record-button">
    <button
      class="record-button_btn"
      :class="{ 'record-button_btn_recording': isRecording }"
      :disabled="disabled"
      @click="$emit('toggle')"
    >
      <span class="record-button_icon" />
    </button>
    <div class="record-button_timer">{{ formattedDuration }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isRecording: boolean
  duration: number
  disabled?: boolean
}>()

defineEmits<{
  toggle: []
}>()

const formattedDuration = computed(() => {
  const h = Math.floor(props.duration / 3600)
  const m = Math.floor((props.duration % 3600) / 60)
  const s = props.duration % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`
})
</script>

<style lang="scss" scoped>
@use '../assets/variables' as *;

.record-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  &_btn {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 3px solid $border;
    background: $bg-secondary;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-normal;

    &:hover:not(:disabled) {
      border-color: $danger;
      background: $danger-subtle;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &_recording {
      border-color: $danger;
      box-shadow: 0 0 0 4px $danger-glow;
      animation: record-pulse 1.5s ease-in-out infinite;

      &:hover:not(:disabled) {
        background: $danger-subtle;
      }
    }
  }

  &_icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: $danger;
    transition: all $transition-normal;

    .record-button_btn_recording & {
      border-radius: $radius-sm;
      width: 20px;
      height: 20px;
    }
  }

  &_timer {
    font-family: $font-mono;
    font-size: 28px;
    font-weight: 300;
    color: $text-primary;
    letter-spacing: 2px;
  }
}

@keyframes record-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 4px $danger-glow;
  }

  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}
</style>
