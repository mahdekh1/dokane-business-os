import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AdjustStockInput, InventoryListQuery, MovementListQuery } from '@dokane/contracts';
import type {
  AdjustStockInput as AdjustStockInputType,
  InventoryItemDto,
  InventoryListQuery as InventoryListQueryType,
  InventoryListResult,
  LocationDto,
  MovementListQuery as MovementListQueryType,
  MovementListResult,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@RequireEntitlement('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @RequirePermission('inventory.view')
  @Get()
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(InventoryListQuery)) query: InventoryListQueryType,
  ): Promise<InventoryListResult> {
    return this.inventory.list(ctx, query);
  }

  @RequirePermission('inventory.view')
  @Get('locations')
  locations(@Ctx() ctx: TenantContext): Promise<LocationDto[]> {
    return this.inventory.listLocations(ctx);
  }

  @RequirePermission('inventory.view')
  @Get('movements')
  movements(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(MovementListQuery)) query: MovementListQueryType,
  ): Promise<MovementListResult> {
    return this.inventory.listMovements(ctx, query);
  }

  @RequirePermission('inventory.manage')
  @Post('adjustments')
  adjust(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(AdjustStockInput)) body: AdjustStockInputType,
  ): Promise<InventoryItemDto> {
    return this.inventory.adjustStock(ctx, body);
  }
}
