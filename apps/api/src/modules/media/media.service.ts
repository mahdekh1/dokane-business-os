import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OfferingDto } from '@dokane/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { TenantContext } from '../../common/tenant-context';
import { CatalogService } from '../catalog/catalog.service';
import { STORAGE_DRIVER } from './storage/storage.provider';
import type { RetrievedMedia, StorageDriver, UploadedFileLike } from './storage/driver';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async uploadOfferingMedia(
    ctx: TenantContext,
    offeringId: string,
    file: UploadedFileLike | undefined,
    altText?: string,
  ): Promise<OfferingDto> {
    const offering = await this.prisma.offering.findFirst({
      where: { id: offeringId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!offering) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!file) throw new BadRequestException({ code: 'NO_FILE', message: 'No file uploaded' });

    // Validate on MIME, not the client filename; derive the extension server-side.
    const ext = ALLOWED[file.mimetype];
    if (!ext) throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, WEBP or GIF images' });
    if (file.size > MAX_BYTES) throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Max 5 MB' });

    const { key } = await this.storage.put(ctx.businessId, file.buffer, ext);
    const agg = await this.prisma.offeringMedia.aggregate({ where: { offeringId }, _max: { sortOrder: true } });
    await this.prisma.offeringMedia.create({
      data: {
        businessId: ctx.businessId,
        offeringId,
        storageKey: key,
        sortOrder: (agg._max.sortOrder ?? -1) + 1,
        altText: altText || null,
      },
    });
    return this.catalog.get(ctx, offeringId);
  }

  serve(key: string): Promise<RetrievedMedia | null> {
    return this.storage.get(key);
  }
}
