import { app, ipcMain, dialog, BrowserWindow } from "electron";
import {
  writeFile,
  access,
  appendFile,
  readFile,
  unlink,
  copyFile,
} from "fs/promises";
import { constants as fsConstants } from "fs";
import { join } from "path";
import { encodeWav, encodeMp3, floatToInt16, Mp3Encoder } from "./encoder";
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
let tempRecordingFormat: "wav" | "mp3" | null = null;

type Mp3EncoderInstance = {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => ArrayLike<number>;
  flush: () => ArrayLike<number>;
};

let mp3Encoder: Mp3EncoderInstance | null = null;
let mp3Pending: Int16Array | null = null;
const MP3_BLOCK_SIZE = 1152;

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
  tempRecordingFormat = null;
  mp3Encoder = null;
  mp3Pending = null;
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

  ipcMain.handle(
    "recording:start-temp",
    async (_event, sampleRate: number, format: string) => {
      await cleanupTempRecording();
      tempRecordingSampleRate = sampleRate;
      tempRecordingFormat = format === "mp3" ? "mp3" : "wav";

      const dir = app.getPath("temp");
      const ext = tempRecordingFormat === "mp3" ? "mp3" : "pcm";
      const filePath = join(
        dir,
        `microphone-recording-${Date.now().toString(36)}.${ext}`,
      );
      await writeFile(filePath, Buffer.alloc(0));
      tempRecordingFile = filePath;

      if (tempRecordingFormat === "mp3") {
        mp3Encoder = new Mp3Encoder(1, sampleRate, 192);
        mp3Pending = null;
      }
    },
  );

  ipcMain.handle(
    "recording:append-chunk",
    async (_event, chunk: ArrayBuffer) => {
      if (!tempRecordingFile) {
        throw new Error("No active temp recording");
      }
      if (tempRecordingFormat === "mp3") {
        if (!mp3Encoder) {
          throw new Error("MP3 encoder is not initialized");
        }
        const floats = new Float32Array(chunk);
        const ints = floatToInt16(floats);

        let samples: Int16Array;
        if (mp3Pending && mp3Pending.length > 0) {
          const combined = new Int16Array(mp3Pending.length + ints.length);
          combined.set(mp3Pending);
          combined.set(ints, mp3Pending.length);
          samples = combined;
        } else {
          samples = ints;
        }

        const fullLength = samples.length - (samples.length % MP3_BLOCK_SIZE);
        const encodedParts: Buffer[] = [];

        for (let i = 0; i < fullLength; i += MP3_BLOCK_SIZE) {
          const block = samples.subarray(i, i + MP3_BLOCK_SIZE);
          const mp3buf = mp3Encoder.encodeBuffer(block);
          if (mp3buf && mp3buf.length > 0) {
            encodedParts.push(Buffer.from(mp3buf));
          }
        }

        mp3Pending =
          fullLength < samples.length ? samples.subarray(fullLength) : null;

        if (encodedParts.length > 0) {
          const buf = Buffer.concat(encodedParts);
          await appendFile(tempRecordingFile, buf);
        }
      } else {
        const buf = Buffer.from(chunk);
        await appendFile(tempRecordingFile, buf);
      }
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

      const effectiveFormat =
        format === "mp3" || format === "wav" ? format : tempRecordingFormat;

      if (effectiveFormat === "mp3") {
        if (!mp3Encoder) {
          throw new Error("MP3 encoder is not initialized");
        }

        const encodedParts: Buffer[] = [];

        if (mp3Pending && mp3Pending.length > 0) {
          const mp3buf = mp3Encoder.encodeBuffer(mp3Pending);
          if (mp3buf && mp3buf.length > 0) {
            encodedParts.push(Buffer.from(mp3buf));
          }
          mp3Pending = null;
        }

        const tail = mp3Encoder.flush();
        if (tail && tail.length > 0) {
          encodedParts.push(Buffer.from(tail));
        }

        if (encodedParts.length > 0) {
          const buf = Buffer.concat(encodedParts);
          await appendFile(tempRecordingFile, buf);
        }

        await copyFile(tempRecordingFile, filePath);
        await addRecentFile(filePath);
        await showFileInExplorer(filePath);
        await cleanupTempRecording();
      } else if (effectiveFormat === "wav") {
        const raw = await readFile(tempRecordingFile);
        const pcm = new Float32Array(
          raw.buffer,
          raw.byteOffset,
          raw.byteLength / Float32Array.BYTES_PER_ELEMENT,
        );
        const encoded = encodeWav(pcm, tempRecordingSampleRate);

        await writeFile(filePath, encoded);

        await addRecentFile(filePath);
        await showFileInExplorer(filePath);
        await cleanupTempRecording();
      } else {
        throw new Error(`Unsupported format: ${format}`);
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
