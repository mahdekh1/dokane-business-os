import { Module } from '@nestjs/common';
import { RegistryController } from './registry.controller';
import { BillingController } from './billing.controller';
import { RegistryService } from './registry.service';
import { EntitlementService } from './entitlement.service';

@Module({
  controllers: [RegistryController, BillingController],
  providers: [RegistryService, EntitlementService],
  exports: [RegistryService, EntitlementService],
})
export class RegistryModule {}
