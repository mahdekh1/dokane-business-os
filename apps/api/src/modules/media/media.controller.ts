import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { OfferingDto } from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { MediaService } from './media.service';
import type { UploadedFileLike } from './storage/driver';

@Controller('catalog')
@RequireEntitlement('catalog')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @RequirePermission('catalog.offerings.manage')
  @Post('offerings/:id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike,
    @Body('altText') altText?: string,
  ): Promise<OfferingDto> {
    return this.media.uploadOfferingMedia(ctx, id, file, altText);
  }
}
