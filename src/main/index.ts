import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { registerIpcHandlers } from "./ipc";
import { autoUpdater } from "electron-updater";
import icon from "../../resources/icon.png?asset";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 440,
    height: 800,
    minWidth: 400,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: `Microphone v${app.getVersion()}`,
    backgroundColor: "#12141a",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!is.dev) {
    try {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (error) {
      console.error("Failed to open DevTools in production", error);
    }
  }

  mainWindow.on("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => callback(permission === "media"),
  );

  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    try {
      mainWindow.setTitle(`Microphone v${app.getVersion()}`);
    } catch (error) {
      console.error("Failed to enforce window title", error);
    }
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function sendUpdateState(state: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update:state", state);
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.microphone");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();
  createWindow();

  if (!is.dev) {
    autoUpdater.autoDownload = false;

    autoUpdater.on("checking-for-update", () => {
      sendUpdateState({ status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      sendUpdateState({
        status: "available",
        version: info.version,
        notes: info.releaseNotes ?? null,
      });
    });

    autoUpdater.on("update-not-available", (info) => {
      sendUpdateState({
        status: "idle",
        currentVersion: info.version,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      sendUpdateState({
        status: "downloading",
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      sendUpdateState({
        status: "downloaded",
        version: info.version,
      });
      try {
        autoUpdater.quitAndInstall();
      } catch (error) {
        console.error("autoUpdater quitAndInstall error", error);
      }
    });

    autoUpdater.on("error", (error) => {
      console.error("autoUpdater error", error);
      sendUpdateState({
        status: "error",
        message: error == null ? "Unknown error" : String(error),
      });
    });

    autoUpdater.checkForUpdates().catch((error) => {
      console.error("autoUpdater checkForUpdates error", error);
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
