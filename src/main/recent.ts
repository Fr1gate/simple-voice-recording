import { app, shell } from "electron";
import { promises as fs } from "fs";
import { dirname, join } from "path";

type RecentStore = {
  files: string[];
};

const STORE_FILE = "recent-recordings.json";
const MAX_ITEMS = 20;

function getStorePath(): string {
  return join(app.getPath("userData"), STORE_FILE);
}

async function readStore(): Promise<RecentStore> {
  const file = getStorePath();
  try {
    const buf = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(buf) as Partial<RecentStore>;
    if (Array.isArray(parsed.files)) {
      return { files: parsed.files.filter((p) => typeof p === "string") };
    }
  } catch {
    // ignore and return empty
  }
  return { files: [] };
}

async function writeStore(store: RecentStore): Promise<void> {
  const file = getStorePath();
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(store, null, 2), "utf-8");
}

export async function addRecentFile(path: string): Promise<void> {
  const store = await readStore();
  const next = [path, ...store.files.filter((p) => p !== path)].slice(
    0,
    MAX_ITEMS,
  );
  await writeStore({ files: next });
}

export async function listRecentFiles(): Promise<string[]> {
  const store = await readStore();
  return store.files;
}

export async function getLastDirectory(): Promise<string> {
  const store = await readStore();
  if (store.files.length > 0) {
    return dirname(store.files[0]);
  }
  return app.getPath("music");
}

export async function showFileInExplorer(path: string): Promise<void> {
  shell.showItemInFolder(path);
}
