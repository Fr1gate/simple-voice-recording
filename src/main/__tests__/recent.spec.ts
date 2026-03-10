/// <reference types="vitest" />

import { join } from 'path'
import os from 'os'
import { promises as fs } from 'fs'

const tmpDir = join(os.tmpdir(), 'microphone-recent-tests')

const shellMock = {
  showItemInFolder: vi.fn()
}

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn((key: string) => {
        if (key === 'userData') {
          return tmpDir
        }
        return tmpDir
      })
    },
    shell: shellMock
  }
})

async function cleanupDir() {
  await fs.rm(tmpDir, { recursive: true, force: true })
  await fs.mkdir(tmpDir, { recursive: true })
}

async function importRecent() {
  return import('../recent')
}

describe('recent files store', () => {
beforeEach(async () => {
  vi.resetModules()
  shellMock.showItemInFolder.mockReset()
  await cleanupDir()
})

test('listRecentFiles returns empty array when store does not exist', async () => {
  const { listRecentFiles } = await importRecent()

  const files = await listRecentFiles()

  expect(files).toEqual([])
})

test('addRecentFile stores unique paths and preserves order', async () => {
  const { addRecentFile, listRecentFiles } = await importRecent()

  await addRecentFile('C:/recordings/one.mp3')
  await addRecentFile('C:/recordings/two.mp3')
  await addRecentFile('C:/recordings/one.mp3')

  const files = await listRecentFiles()

  expect(files[0]).toBe('C:/recordings/one.mp3')
  expect(files[1]).toBe('C:/recordings/two.mp3')
  expect(new Set(files).size).toBe(files.length)
})

test('getLastDirectory returns directory of most recent file', async () => {
  const { addRecentFile, getLastDirectory } = await importRecent()

  await addRecentFile('C:/recordings/sub/last.mp3')
  const dir = await getLastDirectory()

  expect(dir.replace(/\\/g, '/')).toMatch(/C:\/recordings\/sub$/)
})

test('showFileInExplorer delegates to shell.showItemInFolder', async () => {
  const { showFileInExplorer } = await importRecent()

  await showFileInExplorer('C:/recordings/test.mp3')

  expect(shellMock.showItemInFolder).toHaveBeenCalledTimes(1)
  expect(shellMock.showItemInFolder).toHaveBeenCalledWith('C:/recordings/test.mp3')
})
})
