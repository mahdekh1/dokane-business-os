import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from '@dokane/contracts';
import type {
  CreateCustomerInput as CreateCustomerInputType,
  CustomerDto,
  CustomerListQuery as CustomerListQueryType,
  CustomerListResult,
  UpdateCustomerInput as UpdateCustomerInputType,
} from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermission('customers.view')
  @Get()
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(CustomerListQuery)) query: CustomerListQueryType,
  ): Promise<CustomerListResult> {
    return this.customers.list(ctx, query);
  }

  @RequirePermission('customers.view')
  @Get(':id')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<CustomerDto> {
    return this.customers.get(ctx, id);
  }

  @RequirePermission('customers.manage')
  @Post()
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateCustomerInput)) body: CreateCustomerInputType,
  ): Promise<CustomerDto> {
    return this.customers.create(ctx, body);
  }

  @RequirePermission('customers.manage')
  @Patch(':id')
  update(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCustomerInput)) body: UpdateCustomerInputType,
  ): Promise<CustomerDto> {
    return this.customers.update(ctx, id, body);
  }
}
