import { app, ipcMain, dialog, BrowserWindow } from "electron";
import { writeFile, access, appendFile, readFile, unlink } from "fs/promises";
import { constants as fsConstants } from "fs";
import { join } from "path";
import { encodeWav, encodeMp3 } from "./encoder";
import {
  addRecentFile,
  getLastDirectory,
  listRecentFiles,
  showFileInExplorer,
} from "./recent";
import { autoUpdater } from "electron-updater";

const FORMAT_FILTERS: Record<string, Electron.FileFilter[]> = {
  wav: [{ name: "WAV Audio", extensions: ["wav"] }],
  mp3: [{ name: "MP3 Audio", extensions: ["mp3"] }],
};

let tempRecordingFile: string | null = null;
let tempRecordingSampleRate: number | null = null;

async function cleanupTempRecording(): Promise<void> {
  if (tempRecordingFile) {
    try {
      await unlink(tempRecordingFile);
    } catch {
      // ignore
    }
  }
  tempRecordingFile = null;
  tempRecordingSampleRate = null;
}

async function buildDefaultPath(format: string): Promise<string> {
  const baseDir = await getLastDirectory();
  const baseName = "recording";
  const ext = format;

  let index = 1;

  // recording.ext, recording-2.ext, recording-3.ext, ...
  while (true) {
    const name =
      index === 1 ? `${baseName}.${ext}` : `${baseName}-${index}.${ext}`;
    const candidate = join(baseDir, name);
    try {
      await access(candidate, fsConstants.F_OK);
      index += 1;
      continue;
    } catch {
      return candidate;
    }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle("dialog:select-save-path", async (_event, format: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const defaultPath = await buildDefaultPath(format);

    const result = await dialog.showSaveDialog(win, {
      title: "Save Recording",
      defaultPath,
      filters: FORMAT_FILTERS[format] ?? FORMAT_FILTERS.mp3,
    });

    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle(
    "recording:save",
    async (
      _event,
      pcmBuffer: ArrayBuffer,
      sampleRate: number,
      format: string,
      filePath: string,
    ) => {
      const pcm = new Float32Array(pcmBuffer);

      let encoded: Buffer;
      switch (format) {
        case "wav":
          encoded = encodeWav(pcm, sampleRate);
          break;
        case "mp3":
          encoded = encodeMp3(pcm, sampleRate);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      await writeFile(filePath, encoded);
      await addRecentFile(filePath);
      await showFileInExplorer(filePath);
    },
  );

  ipcMain.handle("recent:list", async () => {
    return listRecentFiles();
  });

  ipcMain.handle("recent:open", async (_event, filePath: string) => {
    if (!filePath) return;
    await showFileInExplorer(filePath);
  });

  ipcMain.handle("recording:start-temp", async (_event, sampleRate: number) => {
    await cleanupTempRecording();
    const dir = app.getPath("temp");
    const filePath = join(
      dir,
      `microphone-recording-${Date.now().toString(36)}.pcm`,
    );
    await writeFile(filePath, Buffer.alloc(0));
    tempRecordingFile = filePath;
    tempRecordingSampleRate = sampleRate;
  });

  ipcMain.handle(
    "recording:append-chunk",
    async (_event, chunk: ArrayBuffer) => {
      if (!tempRecordingFile) {
        throw new Error("No active temp recording");
      }
      const buf = Buffer.from(chunk);
      await appendFile(tempRecordingFile, buf);
    },
  );

  ipcMain.handle("recording:cancel-temp", async () => {
    await cleanupTempRecording();
  });

  ipcMain.handle(
    "recording:save-temp",
    async (_event, format: string, filePath: string) => {
      if (!tempRecordingFile || tempRecordingSampleRate === null) {
        throw new Error("No temp recording to save");
      }

      try {
        const raw = await readFile(tempRecordingFile);

        const pcm = new Float32Array(
          raw.buffer,
          raw.byteOffset,
          raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
        );

        let encoded: Buffer;
        switch (format) {
          case "wav":
            encoded = encodeWav(pcm, tempRecordingSampleRate);
            break;
          case "mp3":
            encoded = encodeMp3(pcm, tempRecordingSampleRate);
            break;
          default: {
            throw new Error(`Unsupported format: ${format}`);
          }
        }

        await writeFile(filePath, encoded);

        await addRecentFile(filePath);
        await showFileInExplorer(filePath);
        await cleanupTempRecording();
      } catch (error) {
        throw error;
      }
    },
  );

  ipcMain.handle(
    "window:resize-by-delta",
    async (
      event,
      payload: {
        deltaHeight: number;
      },
    ) => {
      const win =
        BrowserWindow.fromWebContents(event.sender) ??
        BrowserWindow.getFocusedWindow();
      if (!win) return;

      const { deltaHeight } = payload;
      if (!Number.isFinite(deltaHeight) || deltaHeight === 0) return;

      const [currentWidth, currentHeight] = win.getContentSize();

      const minHeight = 360;
      const maxHeight = 900;

      const targetHeight = Math.round(
        Math.min(Math.max(currentHeight + deltaHeight, minHeight), maxHeight),
      );

      console.log("[resize-debug][main] resize-by-delta", {
        deltaHeight,
        currentWidth,
        currentHeight,
        targetHeight,
      });

      win.setContentSize(currentWidth, targetHeight);
    },
  );

  ipcMain.handle("update:start-download", async () => {
    console.log("[update][main] IPC update:start-download");
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error("[update][main] downloadUpdate failed", error);
      throw error;
    }
  });
}
