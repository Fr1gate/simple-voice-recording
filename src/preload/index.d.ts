import { ElectronAPI } from '@electron-toolkit/preload'

interface RecorderAPI {
  selectSavePath(format: string): Promise<string | null>
  saveRecording(
    pcmBuffer: ArrayBuffer,
    sampleRate: number,
    format: string,
    filePath: string
  ): Promise<void>
  getRecentFiles(): Promise<string[]>
  openInExplorer(filePath: string): Promise<void>
  resizeByDelta(deltaHeight: number): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RecorderAPI
  }
}
