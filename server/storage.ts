import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";

/**
 * Provider-agnostic file storage.
 * Designed for small files (logos, attachments). For large/streaming use cases,
 * extend the interface with stream-based operations.
 */
export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface Storage {
  /** One-time setup: directory creation, credential check, etc. Called at server boot. */
  init?(): Promise<void>;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function inferContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${key}`);
    this.name = "InvalidStorageKeyError";
  }
}

function safeJoin(root: string, key: string): string {
  const normalized = path.normalize(key).replace(/^[/\\]+/, "");
  const resolved = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new InvalidStorageKeyError(key);
  }
  return resolved;
}

export class LocalDiskStorage implements Storage {
  constructor(private readonly rootDir: string) {}

  async init(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const filePath = safeJoin(this.rootDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<StoredFile | null> {
    const filePath = safeJoin(this.rootDir, key);
    try {
      const data = await fs.readFile(filePath);
      return { data, contentType: inferContentType(key) };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = safeJoin(this.rootDir, key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = safeJoin(this.rootDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const uploadsRootDir = process.env.UPLOADS_DIR ?? "./uploads";
export const storage: Storage = new LocalDiskStorage(uploadsRootDir);
