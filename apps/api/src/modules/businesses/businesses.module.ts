import { Module } from '@nestjs/common';
import { RegistryModule } from '../registry/registry.module';
import { BusinessesController } from './businesses.controller';
import { PlatformBusinessesController } from './platform-businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [RegistryModule],
  controllers: [BusinessesController, PlatformBusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
