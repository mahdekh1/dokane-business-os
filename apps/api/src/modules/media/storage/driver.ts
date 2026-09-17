/** Minimal shape of an uploaded file (avoids a hard @types/multer dependency). */
export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export interface StoredMedia {
  /** Server-generated, tenant-scoped key (never the client filename). */
  key: string;
}

export interface RetrievedMedia {
  buffer: Buffer;
  contentType: string;
}

/**
 * Storage abstraction. MVP uses the local-disk driver; an S3 driver sits behind
 * the same interface. Moving out is a config/driver change, not a rewrite.
 */
export interface StorageDriver {
  put(businessId: string, buffer: Buffer, ext: string): Promise<StoredMedia>;
  get(key: string): Promise<RetrievedMedia | null>;
  delete(key: string): Promise<void>;
}
