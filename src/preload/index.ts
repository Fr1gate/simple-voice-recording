import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectSavePath: (format: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:select-save-path', format),

  // старый API сохранения по готовому буферу оставляем для совместимости и тестов
  saveRecording: (
    pcmBuffer: ArrayBuffer,
    sampleRate: number,
    format: string,
    filePath: string
  ): Promise<void> =>
    ipcRenderer.invoke('recording:save', pcmBuffer, sampleRate, format, filePath),

  getRecentFiles: (): Promise<string[]> => ipcRenderer.invoke('recent:list'),

  openInExplorer: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('recent:open', filePath),

  resizeByDelta: (deltaHeight: number): Promise<void> =>
    ipcRenderer.invoke('window:resize-by-delta', { deltaHeight }),

  startUpdateDownload: (): Promise<void> =>
    ipcRenderer.invoke('update:start-download'),

  // потоковая запись во временный файл
  startTempRecording: (sampleRate: number): Promise<void> =>
    ipcRenderer.invoke('recording:start-temp', sampleRate),

  appendRecordingChunk: (chunk: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('recording:append-chunk', chunk),

  cancelTempRecording: (): Promise<void> =>
    ipcRenderer.invoke('recording:cancel-temp'),

  saveRecordingFromTemp: (format: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke('recording:save-temp', format, filePath),

  onUpdateState: (listener: (state: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => {
      listener(state)
    }
    ipcRenderer.on('update:state', handler)
    return () => {
      ipcRenderer.removeListener('update:state', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
