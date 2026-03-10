import { inject, ref, type App, type Ref } from 'vue'

export type Locale = 'en' | 'ru' | 'es'

const messages = {
  en: {
    app: {
      title: 'Microphone'
    },
    device: {
      label: 'Device',
      none: 'No devices found',
      defaultName: 'Microphone {id}'
    },
    format: {
      label: 'Format',
      mp3: 'MP3',
      wav: 'WAV'
    },
    savePath: {
      label: 'Save to',
      placeholder: 'Choose file location…',
      browse: 'Browse'
    },
    recent: {
      title: 'Recent recordings'
    },
    status: {
      noDevices: 'No audio devices detected',
      ready: 'Ready to record',
      recording: 'Recording…',
      saving: 'Saving…',
      done: 'Recording saved!',
      error: 'Something went wrong',
      startError: 'Failed to start recording',
      saveError: 'Failed to save recording'
    },
    language: {
      label: 'Language',
      en: 'English',
      ru: 'Русский',
      es: 'Español'
    }
  },
  ru: {
    app: {
      title: 'Микрофон'
    },
    device: {
      label: 'Устройство',
      none: 'Устройства записи не найдены',
      defaultName: 'Микрофон {id}'
    },
    format: {
      label: 'Формат',
      mp3: 'MP3',
      wav: 'WAV'
    },
    savePath: {
      label: 'Путь сохранения',
      placeholder: 'Выберите путь для сохранения…',
      browse: 'Обзор'
    },
    recent: {
      title: 'Последние записи'
    },
    status: {
      noDevices: 'Устройства записи не найдены',
      ready: 'Готов к записи',
      recording: 'Идёт запись…',
      saving: 'Сохранение…',
      done: 'Запись сохранена!',
      error: 'Произошла ошибка',
      startError: 'Не удалось начать запись',
      saveError: 'Не удалось сохранить запись'
    },
    language: {
      label: 'Язык',
      en: 'English',
      ru: 'Русский',
      es: 'Español'
    }
  },
  es: {
    app: {
      title: 'Micrófono'
    },
    device: {
      label: 'Dispositivo',
      none: 'No se encontraron dispositivos',
      defaultName: 'Micrófono {id}'
    },
    format: {
      label: 'Formato',
      mp3: 'MP3',
      wav: 'WAV'
    },
    savePath: {
      label: 'Guardar en',
      placeholder: 'Elige la ubicación del archivo…',
      browse: 'Examinar'
    },
    recent: {
      title: 'Grabaciones recientes'
    },
    status: {
      noDevices: 'No se detectaron dispositivos de audio',
      ready: 'Listo para grabar',
      recording: 'Grabando…',
      saving: 'Guardando…',
      done: 'Grabación guardada',
      error: 'Algo salió mal',
      startError: 'No se pudo iniciar la grabación',
      saveError: 'No se pudo guardar la grabación'
    },
    language: {
      label: 'Idioma',
      en: 'English',
      ru: 'Русский',
      es: 'Español'
    }
  }
} as const

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('locale') as Locale | null
    if (saved && ['en', 'ru', 'es'].includes(saved)) {
      return saved
    }

    const nav = window.navigator.language.toLowerCase()
    if (nav.startsWith('ru')) return 'ru'
    if (nav.startsWith('es')) return 'es'
  }

  return 'en'
}

type Messages = typeof messages

type I18nContext = {
  locale: Ref<Locale>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18N_SYMBOL = Symbol('i18n')

function resolveMessageKey(obj: Messages[keyof Messages], path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, obj)
}

function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key]
    return value == null ? '' : String(value)
  })
}

export function createI18nPlugin() {
  const locale = ref<Locale>(getInitialLocale())

  const ctx: I18nContext = {
    locale,
    t(key, params) {
      const current = messages[locale.value]
      const raw = resolveMessageKey(current, key)
      if (typeof raw !== 'string') return key
      return formatMessage(raw, params)
    }
  }

  return {
    install(app: App) {
      app.provide(I18N_SYMBOL, ctx)
    }
  }
}

export function useI18n(): I18nContext {
  const ctx = inject<I18nContext>(I18N_SYMBOL)
  if (!ctx) {
    throw new Error('i18n context is not provided')
  }
  return ctx
}

const i18nPlugin = createI18nPlugin()

export default i18nPlugin


