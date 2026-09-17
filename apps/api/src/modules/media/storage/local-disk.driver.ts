import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { RetrievedMedia, StorageDriver, StoredMedia } from './driver';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Stores under <root>/<businessId>/<random>.<ext>. Keys are server-generated. */
export class LocalDiskDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  async put(businessId: string, buffer: Buffer, ext: string): Promise<StoredMedia> {
    const key = `${businessId}/${randomBytes(16).toString('hex')}.${ext}`;
    const full = path.join(this.root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return { key };
  }

  async get(key: string): Promise<RetrievedMedia | null> {
    // Only well-formed tenant keys — blocks path traversal.
    if (!/^[0-9a-f-]+\/[0-9a-f]+\.[a-z0-9]+$/i.test(key)) return null;
    try {
      const buffer = await fs.readFile(path.join(this.root, key));
      const ext = key.split('.').pop()!.toLowerCase();
      return { buffer, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!/^[0-9a-f-]+\/[0-9a-f]+\.[a-z0-9]+$/i.test(key)) return;
    try {
      await fs.unlink(path.join(this.root, key));
    } catch {
      /* already gone */
    }
  }
}
