import { ipcMain, dialog, BrowserWindow } from "electron";
import { writeFile, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { join } from "path";
import { encodeWav, encodeMp3 } from "./encoder";
import {
  addRecentFile,
  getLastDirectory,
  listRecentFiles,
  showFileInExplorer,
} from "./recent";

const FORMAT_FILTERS: Record<string, Electron.FileFilter[]> = {
  wav: [{ name: "WAV Audio", extensions: ["wav"] }],
  mp3: [{ name: "MP3 Audio", extensions: ["mp3"] }],
};

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
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    // main/index.ts already registered autoUpdater listeners and disabled autoDownload.
    // Here we just trigger the download when the user agrees.
    const { autoUpdater } = await import("electron-updater");
    await autoUpdater.downloadUpdate();
  });
}
