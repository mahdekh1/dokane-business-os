import { Module } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';
import { EntitlementService } from './entitlement.service';

@Module({
  controllers: [RegistryController],
  providers: [RegistryService, EntitlementService],
  exports: [RegistryService, EntitlementService],
})
export class RegistryModule {}
