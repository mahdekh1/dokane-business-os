import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { CreateOrderInput, OrderListQuery, TransitionOrderInput } from '@dokane/contracts';
import type {
  CreateOrderInput as CreateOrderInputType,
  OrderDto,
  OrderListQuery as OrderListQueryType,
  OrderListResult,
  TransitionOrderInput as TransitionOrderInputType,
} from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

/**
 * Orders are core (every plan can sell). Permission-gated, not entitlement-gated.
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RequirePermission('orders.view')
  @Get()
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(OrderListQuery)) query: OrderListQueryType,
  ): Promise<OrderListResult> {
    return this.orders.list(ctx, query);
  }

  @RequirePermission('orders.view')
  @Get(':id')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<OrderDto> {
    return this.orders.get(ctx, id);
  }

  @RequirePermission('orders.manage')
  @Post()
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateOrderInput)) body: CreateOrderInputType,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<OrderDto> {
    return this.orders.create(ctx, body, idempotencyKey?.slice(0, 200) || undefined);
  }

  @RequirePermission('orders.manage')
  @Post(':id/transitions')
  transition(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionOrderInput)) body: TransitionOrderInputType,
  ): Promise<OrderDto> {
    return this.orders.transition(ctx, id, body.fulfillmentStatus);
  }
}
