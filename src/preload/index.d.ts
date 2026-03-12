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
  startUpdateDownload(): Promise<void>
  onUpdateState(listener: (state: unknown) => void): () => void
  startTempRecording(sampleRate: number, format: string): Promise<void>
  appendRecordingChunk(chunk: ArrayBuffer): Promise<void>
  cancelTempRecording(): Promise<void>
  saveRecordingFromTemp(format: string, filePath: string): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RecorderAPI
  }
}
