import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { PublicMediaController } from './public-media.controller';
import { storageProvider } from './storage/storage.provider';

@Module({
  imports: [CatalogModule],
  controllers: [MediaController, PublicMediaController],
  providers: [MediaService, storageProvider],
})
export class MediaModule {}
