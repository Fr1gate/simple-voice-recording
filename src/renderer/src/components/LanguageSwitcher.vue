<template>
  <div class="lang-switcher">
    <span class="lang-switcher_label">{{ t('language.label') }}</span>
    <div class="lang-switcher_buttons">
      <button
        v-for="item in items"
        :key="item.code"
        class="lang-switcher_button"
        :class="{ 'lang-switcher_button_active': currentLocale === item.code }"
        type="button"
        @click="setLocale(item.code)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'
import type { Locale } from '../i18n'

const { locale, t } = useI18n()

const items = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'es', label: 'ES' }
] as const satisfies { code: Locale; label: string }[]

const currentLocale = computed(() => locale.value as Locale)

function setLocale(next: Locale): void {
  if (locale.value === next) return
  locale.value = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('locale', next)
  }
}
</script>

<style lang="scss" scoped>
@use '../assets/variables' as *;

.lang-switcher {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  &_label {
    font-size: 11px;
    font-weight: 500;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  &_buttons {
    display: flex;
    gap: 4px;
    background: $bg-secondary;
    padding: 2px;
    border-radius: $radius-sm;
  }

  &_button {
    min-width: 32px;
    padding: 4px 8px;
    border-radius: $radius-sm;
    border: none;
    background: transparent;
    color: $text-secondary;
    font-size: 11px;
    font-weight: 600;
    font-family: $font-family;
    cursor: pointer;
    transition: background-color $transition-fast, color $transition-fast;

    &_active {
      background: $accent-subtle;
      color: $accent;
    }

    &:not(&_active):hover {
      background: $bg-hover;
      color: $text-primary;
    }
  }
}
</style>

