import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LifecycleNote } from '@dokane/contracts';
import type { BusinessDto, LifecycleNote as LifecycleNoteType } from '@dokane/contracts';
import type { BusinessStatus } from '@prisma/client';
import { RequirePlatformPermission, UserId } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { BusinessesService } from './businesses.service';

@Controller('platform/businesses')
export class PlatformBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @RequirePlatformPermission('platform.businesses.view')
  @Get()
  list(@Query('status') status?: BusinessStatus): Promise<BusinessDto[]> {
    return this.businesses.listBusinesses(status);
  }

  @RequirePlatformPermission('platform.businesses.view')
  @Get(':id')
  get(@Param('id') id: string): Promise<BusinessDto> {
    return this.businesses.getBusiness(id);
  }

  @RequirePlatformPermission('platform.businesses.approve')
  @Post(':id/approve')
  approve(@UserId() adminId: string, @Param('id') id: string): Promise<BusinessDto> {
    return this.businesses.approve(adminId, id);
  }

  @RequirePlatformPermission('platform.businesses.reject')
  @Post(':id/reject')
  reject(
    @UserId() adminId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LifecycleNote)) body: LifecycleNoteType,
  ): Promise<BusinessDto> {
    return this.businesses.reject(adminId, id, body.note);
  }

  @RequirePlatformPermission('platform.businesses.approve')
  @Post(':id/request-changes')
  requestChanges(
    @UserId() adminId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LifecycleNote)) body: LifecycleNoteType,
  ): Promise<BusinessDto> {
    return this.businesses.requestChanges(adminId, id, body.note);
  }

  @RequirePlatformPermission('platform.businesses.suspend')
  @Post(':id/suspend')
  suspend(
    @UserId() adminId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LifecycleNote)) body: LifecycleNoteType,
  ): Promise<BusinessDto> {
    return this.businesses.suspend(adminId, id, body.note);
  }

  @RequirePlatformPermission('platform.businesses.suspend')
  @Post(':id/reactivate')
  reactivate(@UserId() adminId: string, @Param('id') id: string): Promise<BusinessDto> {
    return this.businesses.reactivate(adminId, id);
  }
}
