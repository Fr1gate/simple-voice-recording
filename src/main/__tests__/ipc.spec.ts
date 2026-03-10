/// <reference types="vitest" />

const handlers: Record<string, (...args: any[]) => any> = {}

vi.mock('electron', () => {
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers[channel] = handler
    })
  }

  const dialog = {
    showSaveDialog: vi.fn()
  }

  const BrowserWindow = {
    getFocusedWindow: vi.fn()
  }

  return {
    ipcMain,
    dialog,
    BrowserWindow
  }
})

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../encoder', () => ({
  encodeWav: vi.fn(() => Buffer.from('wav-bytes')),
  encodeMp3: vi.fn(() => Buffer.from('mp3-bytes'))
}))

async function importIpc() {
  return import('../ipc')
}

beforeEach(async () => {
  for (const key of Object.keys(handlers)) {
    delete handlers[key]
  }

  vi.resetModules()
  await importIpc().then((mod) => {
    mod.registerIpcHandlers()
  })
})

test('dialog:select-save-path returns null when there is no focused window', async () => {
  const { BrowserWindow } = await import('electron')

  ;(BrowserWindow.getFocusedWindow as unknown as vi.Mock).mockReturnValue(null)

  const handler = handlers['dialog:select-save-path']
  const result = await handler({}, 'mp3')

  expect(result).toBeNull()
})

test('dialog:select-save-path returns selected path', async () => {
  const { BrowserWindow, dialog } = await import('electron')

  ;(BrowserWindow.getFocusedWindow as unknown as vi.Mock).mockReturnValue({})
  ;(dialog.showSaveDialog as unknown as vi.Mock).mockResolvedValue({
    canceled: false,
    filePath: 'C:/recordings/test.mp3'
  })

  const handler = handlers['dialog:select-save-path']
  const result = await handler({}, 'mp3')

  expect(dialog.showSaveDialog).toHaveBeenCalled()
  expect(result).toBe('C:/recordings/test.mp3')
})

test('recording:save encodes using correct format and writes file', async () => {
  const { encodeWav, encodeMp3 } = await import('../encoder')
  const { writeFile } = await import('fs/promises')

  const pcm = new Float32Array([0, 0.5, -0.5])
  const buffer = pcm.buffer
  const sampleRate = 44100

  const saveHandler = handlers['recording:save']

  await saveHandler({}, buffer, sampleRate, 'mp3', 'C:/recordings/test.mp3')
  expect(encodeMp3).toHaveBeenCalledTimes(1)
  expect(encodeMp3).toHaveBeenCalledWith(expect.any(Float32Array), sampleRate)
  expect(writeFile).toHaveBeenCalledWith('C:/recordings/test.mp3', Buffer.from('mp3-bytes'))

  ;(encodeWav as unknown as vi.Mock).mockClear()
  ;(encodeMp3 as unknown as vi.Mock).mockClear()
  ;(writeFile as unknown as vi.Mock).mockClear()

  await saveHandler({}, buffer, sampleRate, 'wav', 'C:/recordings/test.wav')
  expect(encodeWav).toHaveBeenCalledTimes(1)
  expect(encodeWav).toHaveBeenCalledWith(expect.any(Float32Array), sampleRate)
  expect(writeFile).toHaveBeenCalledWith('C:/recordings/test.wav', Buffer.from('wav-bytes'))
})

test('recording:save throws for unsupported format', async () => {
  const saveHandler = handlers['recording:save']
  const pcm = new Float32Array([0])
  const buffer = pcm.buffer

  await expect(
    saveHandler({}, buffer, 44100, 'flac', 'C:/recordings/test.flac')
  ).rejects.toThrowError(/Unsupported format/)
})

