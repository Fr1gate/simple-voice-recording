<template>
  <div class="app">
    <header class="app_header">
      <h1 class="app_title">{{ t("app.title") }}</h1>
      <LanguageSwitcher />
    </header>

    <main class="app_content">
      <DeviceSelector
        v-model="selectedDeviceId"
        :devices="devices"
        :disabled="isRecording"
      />
      <FormatSelector v-model="format" :disabled="isRecording" />
      <SavePath v-model="savePath" :format="format" :disabled="isRecording" />

      <section v-if="recentFiles.length" class="app_recent">
        <h2 class="app_recent-title">{{ t("recent.title") }}</h2>
        <ul class="app_recent-list">
          <li v-for="file in recentFiles" :key="file" class="app_recent-item">
            <button
              type="button"
              class="app_recent-button"
              @click="openRecent(file)"
            >
              <span class="app_recent-name">{{ getFileName(file) }}</span>
              <span class="app_recent-path">{{ getFileDirectory(file) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </main>

    <div class="app_controls">
      <RecordButton
        :is-recording="isRecording"
        :duration="duration"
        :disabled="status === 'saving' || devices.length === 0"
        @toggle="handleToggle"
      />
    </div>

    <footer class="app_status">
      <span class="app_status-text" :class="statusClass">{{ statusText }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useI18n } from "./i18n";
import DeviceSelector from "./components/DeviceSelector.vue";
import FormatSelector from "./components/FormatSelector.vue";
import SavePath from "./components/SavePath.vue";
import RecordButton from "./components/RecordButton.vue";
import LanguageSwitcher from "./components/LanguageSwitcher.vue";
import { useAudioRecorder } from "./composables/useAudioRecorder";

type Status = "idle" | "recording" | "saving" | "done" | "error";

const { t } = useI18n();

const {
  devices,
  selectedDeviceId,
  isRecording,
  duration,
  startRecording,
  stopRecording,
} = useAudioRecorder();

const format = ref("mp3");
const savePath = ref("");
const status = ref<Status>("idle");
const errorMessage = ref("");
const recentFiles = ref<string[]>([]);

const statusText = computed(() => {
  switch (status.value) {
    case "idle":
      return devices.value.length === 0
        ? t("status.noDevices")
        : t("status.ready");
    case "recording":
      return t("status.recording");
    case "saving":
      return t("status.saving");
    case "done":
      return t("status.done");
    case "error":
      return errorMessage.value || t("status.error");
    default:
      return "";
  }
});

const statusClass = computed(() => {
  if (status.value === "idle") return "";
  return `app_status-text_${status.value}`;
});

watch(format, (ext) => {
  if (savePath.value) {
    savePath.value = savePath.value.replace(/\.[^.]+$/, `.${ext}`);
  }
});

async function handleToggle(): Promise<void> {
  if (isRecording.value) {
    await handleStop();
  } else {
    await handleStart();
  }
}

async function handleStart(): Promise<void> {
  try {
    errorMessage.value = "";
    await startRecording();
    status.value = "recording";
  } catch (e) {
    status.value = "error";
    errorMessage.value =
      e instanceof Error ? e.message : t("status.startError");
  }
}

async function handleStop(): Promise<void> {
  try {
    const { pcmData, sampleRate } = await stopRecording();

    let path = savePath.value;
    if (!path) {
      const selected = await window.api.selectSavePath(format.value);
      if (!selected) {
        status.value = "idle";
        return;
      }
      path = selected;
      savePath.value = path;
    }

    status.value = "saving";
    await window.api.saveRecording(
      pcmData.buffer as ArrayBuffer,
      sampleRate,
      format.value,
      path,
    );
    status.value = "done";
    if (!recentFiles.value.includes(path)) {
      recentFiles.value = [path, ...recentFiles.value].slice(0, 20);
    }
    // Reset explicit path so the next recording uses a fresh default name
    savePath.value = "";

    setTimeout(() => {
      if (status.value === "done") status.value = "idle";
    }, 3000);
  } catch (e) {
    status.value = "error";
    errorMessage.value = e instanceof Error ? e.message : t("status.saveError");
  }
}

function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

function getFileDirectory(path: string): string {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("\\");
}

async function openRecent(path: string): Promise<void> {
  await window.api.openInExplorer(path);
}

onMounted(async () => {
  try {
    recentFiles.value = await window.api.getRecentFiles();
  } catch {
    recentFiles.value = [];
  }
});
</script>

<style lang="scss" scoped>
@use "./assets/variables" as *;

.app {
  width: 100%;
  max-width: 400px;
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  &_header {
    text-align: center;
  }

  &_title {
    font-size: 20px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: 0.3px;
  }

  &_content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &_controls {
    display: flex;
    justify-content: center;
    padding: 12px 0;
  }

  &_status {
    text-align: center;
    min-height: 20px;
  }

  &_status-text {
    font-size: 13px;
    color: $text-muted;
    transition: color $transition-fast;

    &_recording {
      color: $danger;
    }

    &_saving {
      color: $accent;
    }

    &_done {
      color: $success;
    }

    &_error {
      color: $danger;
    }
  }

  &_recent {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid $border;
  }

  &_recent-title {
    font-size: 12px;
    font-weight: 600;
    color: $text-secondary;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 6px;
  }

  &_recent-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 120px;
    overflow-y: auto;
  }

  &_recent-button {
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border-radius: $radius-sm;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background-color $transition-fast;

    &:hover {
      background: $bg-hover;
    }
  }

  &_recent-name {
    font-size: 12px;
    color: $text-primary;
  }

  &_recent-path {
    font-size: 11px;
    color: $text-muted;
  }
}
</style>
