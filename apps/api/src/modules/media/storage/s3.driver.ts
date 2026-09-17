import type { RetrievedMedia, StorageDriver, StoredMedia } from './driver';

/**
 * S3-compatible driver — the seam is ready; wiring an SDK is a later task. Selected
 * by STORAGE_DRIVER=s3. Throws until implemented so misconfig fails loudly.
 */
export class S3Driver implements StorageDriver {
  put(): Promise<StoredMedia> {
    throw new Error('S3Driver not implemented yet — set STORAGE_DRIVER=local');
  }
  get(): Promise<RetrievedMedia | null> {
    throw new Error('S3Driver not implemented yet — set STORAGE_DRIVER=local');
  }
  delete(): Promise<void> {
    throw new Error('S3Driver not implemented yet — set STORAGE_DRIVER=local');
  }
}
