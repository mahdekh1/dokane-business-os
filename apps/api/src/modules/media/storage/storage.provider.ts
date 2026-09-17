import * as path from 'path';
import type { StorageDriver } from './driver';
import { LocalDiskDriver } from './local-disk.driver';
import { S3Driver } from './s3.driver';

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** Selects the driver from STORAGE_DRIVER (local | s3); local is the MVP default. */
export const storageProvider = {
  provide: STORAGE_DRIVER,
  useFactory: (): StorageDriver => {
    if (process.env.STORAGE_DRIVER === 's3') return new S3Driver();
    const root = process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), 'storage');
    return new LocalDiskDriver(root);
  },
};
