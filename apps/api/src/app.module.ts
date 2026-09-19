import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './common/events/events.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RegistryModule } from './modules/registry/registry.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { BrandingModule } from './modules/branding/branding.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CrmModule } from './modules/crm/crm.module';
import { PmModule } from './modules/pm/pm.module';
import { AuthGuard } from './common/guards/auth.guard';
import { PlatformGuard } from './common/guards/platform.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { EntitlementGuard } from './modules/registry/entitlement.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    EventsModule,
    AuditModule,
    AuthModule,
    MeModule,
    RbacModule,
    RegistryModule,
    BusinessesModule,
    BrandingModule,
    CatalogModule,
    InventoryModule,
    MediaModule,
    CustomersModule,
    ChannelsModule,
    OrdersModule,
    AccountingModule,
    InvoicesModule,
    CrmModule,
    PmModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global guard order: throttle → authenticate → platform admin → resolve
    // tenant + permission → entitlement.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PlatformGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: EntitlementGuard },
  ],
})
export class AppModule {}
