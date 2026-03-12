<template>
  <div class="app">
    <header class="app_header">
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
        :is-paused="isPaused"
        :duration="displayedDuration"
        :disabled="status === 'saving' || devices.length === 0"
        :pause-label="t('controls.pause')"
        :resume-label="t('controls.resume')"
        @toggle="handleToggle"
        @pause-toggle="handlePauseToggle"
      />
    </div>

    <footer class="app_status">
      <span class="app_status-text" :class="statusClass">{{ statusText }}</span>

      <div v-if="updateStatus !== 'idle'" class="app_update">
        <div v-if="updateStatus === 'available'" class="app_update-row">
          <span class="app_update-text">
            {{
              updateVersion
                ? `Доступна новая версия ${updateVersion}`
                : "Доступна новая версия"
            }}
          </span>
          <button
            type="button"
            class="app_update-button"
            @click="startUpdateDownload"
          >
            Обновить
          </button>
        </div>

        <div
          v-else-if="updateStatus === 'downloading'"
          class="app_update-row app_update-row_downloading"
        >
          <div class="app_update-progress-bar">
            <div
              class="app_update-progress-fill"
              :style="{ width: updatePercent + '%' }"
            />
          </div>
          <div class="app_update-meta">
            <span>{{ formattedUpdatePercent }}</span>
            <span v-if="formattedUpdateSpeed">{{ formattedUpdateSpeed }}</span>
          </div>
        </div>

        <div v-else-if="updateStatus === 'downloaded'" class="app_update-row">
          <span class="app_update-text">
            Обновление скачано, приложение будет перезапущено…
          </span>
        </div>

        <div v-else-if="updateStatus === 'checking'" class="app_update-row">
          <span class="app_update-text">Проверка обновлений…</span>
        </div>

        <div
          v-else-if="updateStatus === 'error'"
          class="app_update-row app_update-row_error"
        >
          <div class="app_update-error-body">
            <div class="app_update-error-message">
              Ошибка обновления:
              <span v-if="updateError">{{ updateError }}</span>
              <span v-else>Неизвестная ошибка</span>
            </div>
            <button
              v-if="updateError"
              type="button"
              class="app_update-button app_update-button_copy"
              @click="copyUpdateError"
            >
              Скопировать текст ошибки
            </button>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useI18n } from "./i18n";
import DeviceSelector from "./components/DeviceSelector.vue";
import FormatSelector from "./components/FormatSelector.vue";
import SavePath from "./components/SavePath.vue";
import RecordButton from "./components/RecordButton.vue";
import LanguageSwitcher from "./components/LanguageSwitcher.vue";
import { useAudioRecorder } from "./composables/useAudioRecorder";

type Status = "idle" | "recording" | "paused" | "saving" | "done" | "error";

const { t } = useI18n();

const {
  devices,
  selectedDeviceId,
  isRecording,
  isPaused,
  duration,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
} = useAudioRecorder();

const format = ref("mp3");
const savePath = ref("");
const status = ref<Status>("idle");
const errorMessage = ref("");
const recentFiles = ref<string[]>([]);

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

const updateStatus = ref<UpdateStatus>("idle");
const updateVersion = ref<string | null>(null);
const updateError = ref<string | null>(null);
const updatePercent = ref(0);
const updateBytesPerSecond = ref(0);
const updateTransferred = ref(0);
const updateTotal = ref(0);

const displayedDuration = computed(() => {
  return status.value === "recording" || status.value === "paused"
    ? duration.value
    : 0;
});

const formattedUpdateSpeed = computed(() => {
  const bps = updateBytesPerSecond.value;
  if (!bps) return "";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
});

const formattedUpdatePercent = computed(() => {
  return `${updatePercent.value.toFixed(0)}%`;
});

const statusText = computed(() => {
  switch (status.value) {
    case "idle":
      return devices.value.length === 0
        ? t("status.noDevices")
        : t("status.ready");
    case "recording":
      return t("status.recording");
    case "paused":
      return t("status.paused");
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

async function handlePauseToggle(): Promise<void> {
  if (!isRecording.value) return;
  try {
    if (isPaused.value) {
      await resumeRecording();
      status.value = "recording";
    } else {
      await pauseRecording();
      status.value = "paused";
    }
  } catch (e) {
    status.value = "error";
    errorMessage.value = e instanceof Error ? e.message : t("status.error");
  }
}

async function handleStart(): Promise<void> {
  try {
    errorMessage.value = "";
    await startRecording(format.value);
    status.value = "recording";
  } catch (e) {
    status.value = "error";
    errorMessage.value =
      e instanceof Error ? e.message : t("status.startError");
  }
}

async function handleStop(): Promise<void> {
  try {
    await stopRecording();

    let path = savePath.value;
    if (!path) {
      const selected = await window.api.selectSavePath(format.value);
      if (!selected) {
        status.value = "idle";
        await window.api.cancelTempRecording();
        return;
      }
      path = selected;
      savePath.value = path;
    }

    status.value = "saving";
    await window.api.saveRecordingFromTemp(format.value, path);
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
    try {
      await window.api.cancelTempRecording();
    } catch {
      // ignore cleanup errors
    }
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

async function startUpdateDownload(): Promise<void> {
  try {
    if (updateStatus.value !== "available") return;
    updateStatus.value = "downloading";
    await window.api.startUpdateDownload();
  } catch (err) {
    console.error("[update] start download failed", err);
    updateStatus.value = "error";
    updateError.value = err instanceof Error ? err.message : String(err);
  }
}

async function adjustWindowHeightToContent(): Promise<void> {
  try {
    await nextTick();
    const root = document.querySelector(".app") as HTMLElement | null;
    if (!root) return;
    const contentHeight = root.scrollHeight;
    const viewportHeight = window.innerHeight;
    const delta = contentHeight - viewportHeight;
    if (Math.abs(delta) > 2) {
      await window.api.resizeByDelta(delta);
    }
  } catch (err) {
    console.error("[resize-debug] resize failed", err);
  }
}

async function copyUpdateError(): Promise<void> {
  if (!updateError.value) return;
  try {
    await navigator.clipboard.writeText(updateError.value);
  } catch (err) {
    console.error("[update] copy error text failed", err);
  }
}

onMounted(async () => {
  try {
    recentFiles.value = await window.api.getRecentFiles();
  } catch {
    recentFiles.value = [];
  }
  try {
    window.api.onUpdateState((state: unknown) => {
      console.log("[update] state:", state);
      if (!state || typeof state !== "object") {
        updateStatus.value = "idle";
        void adjustWindowHeightToContent();
        return;
      }

      const raw = state as Record<string, unknown>;
      const st =
        typeof raw.status === "string" ? (raw.status as string) : "idle";

      switch (st) {
        case "checking":
          updateStatus.value = "checking";
          updateError.value = null;
          break;
        case "available":
          updateStatus.value = "available";
          updateVersion.value =
            typeof raw.version === "string" ? (raw.version as string) : null;
          updateError.value = null;
          break;
        case "downloading":
          updateStatus.value = "downloading";
          updatePercent.value =
            typeof raw.percent === "number" ? (raw.percent as number) : 0;
          updateBytesPerSecond.value =
            typeof raw.bytesPerSecond === "number"
              ? (raw.bytesPerSecond as number)
              : 0;
          updateTransferred.value =
            typeof raw.transferred === "number"
              ? (raw.transferred as number)
              : 0;
          updateTotal.value =
            typeof raw.total === "number" ? (raw.total as number) : 0;
          updateError.value = null;
          break;
        case "downloaded":
          updateStatus.value = "downloaded";
          if (typeof raw.version === "string") {
            updateVersion.value = raw.version as string;
          }
          updateError.value = null;
          break;
        case "error":
          updateStatus.value = "error";
          updateError.value =
            typeof raw.message === "string"
              ? (raw.message as string)
              : "Update error";
          break;
        case "idle":
        default:
          updateStatus.value = "idle";
          break;
      }

      void adjustWindowHeightToContent();
    });

    await adjustWindowHeightToContent();
  } catch (err) {
    console.error("[update] subscribe/resize failed", err);
  }
});
</script>

<style lang="scss" scoped>
@use "./assets/variables" as *;

.app {
  width: 100%;
  max-width: 400px;
  padding: 0 28px 8px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  &_header {
    text-align: center;
    padding-top: 4px;
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

  &_update {
    margin-top: 8px;
    font-size: 12px;
    color: $text-secondary;
  }

  &_update-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    &_downloading {
      flex-direction: column;
      align-items: stretch;
    }

    &_error {
      color: $danger;
    }
  }

  &_update-text {
    flex: 1;
    text-align: left;
  }

  &_update-button {
    padding: 4px 10px;
    border-radius: $radius-sm;
    border: 1px solid $accent;
    color: $accent;
    background: $accent-subtle;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;

    &:hover {
      background: $accent;
      color: $bg-primary;
    }
  }

  &_update-button_copy {
    align-self: flex-start;
  }

  &_update-progress-bar {
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: $bg-secondary;
    overflow: hidden;
  }

  &_update-progress-fill {
    height: 100%;
    background: $accent;
    width: 0;
    transition: width 200ms linear;
  }

  &_update-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: $text-muted;
  }

  &_update-error-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 96px;
    overflow-y: auto;
    text-align: left;
    user-select: text;
  }

  &_update-error-message {
    font-size: 11px;
    color: $text-muted;
    white-space: pre-wrap;
    word-break: break-word;
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
