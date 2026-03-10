import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  selectSavePath: (format: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:select-save-path', format),

  saveRecording: (
    pcmBuffer: ArrayBuffer,
    sampleRate: number,
    format: string,
    filePath: string
  ): Promise<void> => ipcRenderer.invoke('recording:save', pcmBuffer, sampleRate, format, filePath),

  getRecentFiles: (): Promise<string[]> => ipcRenderer.invoke('recent:list'),

  openInExplorer: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('recent:open', filePath),

  resizeByDelta: (deltaHeight: number): Promise<void> =>
    ipcRenderer.invoke('window:resize-by-delta', { deltaHeight }),

  startUpdateDownload: (): Promise<void> =>
    ipcRenderer.invoke('update:start-download'),

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
