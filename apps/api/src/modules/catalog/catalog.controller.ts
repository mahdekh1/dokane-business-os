import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateCategoryInput,
  CreateOfferingInput,
  OfferingListQuery,
  UpdateCategoryInput,
  UpdateOfferingInput,
} from '@dokane/contracts';
import type {
  CategoryDto,
  CreateCategoryInput as CreateCategoryInputType,
  CreateOfferingInput as CreateOfferingInputType,
  OfferingDto,
  OfferingListQuery as OfferingListQueryType,
  OfferingListResult,
  UpdateCategoryInput as UpdateCategoryInputType,
  UpdateOfferingInput as UpdateOfferingInputType,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@RequireEntitlement('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @RequirePermission('catalog.offerings.view')
  @Get('offerings')
  list(
    @Ctx() ctx: TenantContext,
    @Query(new ZodValidationPipe(OfferingListQuery)) query: OfferingListQueryType,
  ): Promise<OfferingListResult> {
    return this.catalog.list(ctx, query);
  }

  @RequirePermission('catalog.offerings.view')
  @Get('offerings/:id')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<OfferingDto> {
    return this.catalog.get(ctx, id);
  }

  @RequirePermission('catalog.offerings.manage')
  @Post('offerings')
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateOfferingInput)) body: CreateOfferingInputType,
  ): Promise<OfferingDto> {
    return this.catalog.create(ctx, body);
  }

  @RequirePermission('catalog.offerings.manage')
  @Patch('offerings/:id')
  update(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOfferingInput)) body: UpdateOfferingInputType,
  ): Promise<OfferingDto> {
    return this.catalog.update(ctx, id, body);
  }

  @RequirePermission('catalog.offerings.manage')
  @Delete('offerings/:id')
  archive(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<OfferingDto> {
    return this.catalog.archive(ctx, id);
  }

  @RequirePermission('catalog.offerings.view')
  @Get('categories')
  listCategories(@Ctx() ctx: TenantContext): Promise<CategoryDto[]> {
    return this.catalog.listCategories(ctx);
  }

  @RequirePermission('catalog.categories.manage')
  @Post('categories')
  createCategory(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateCategoryInput)) body: CreateCategoryInputType,
  ): Promise<CategoryDto> {
    return this.catalog.createCategory(ctx, body);
  }

  @RequirePermission('catalog.categories.manage')
  @Patch('categories/:id')
  updateCategory(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCategoryInput)) body: UpdateCategoryInputType,
  ): Promise<CategoryDto> {
    return this.catalog.updateCategory(ctx, id, body);
  }
}
