import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateChannelInput, UpdateChannelInput } from '@dokane/contracts';
import type {
  ChannelDto,
  CreateChannelInput as CreateChannelInputType,
  UpdateChannelInput as UpdateChannelInputType,
} from '@dokane/contracts';
import { Ctx, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ChannelsService } from './channels.service';

/**
 * Sales channels are core infrastructure (every order references one), so the
 * controller is permission-gated but NOT entitlement-gated — a Starter business
 * can still sell. The "Sales Channels" module only governs nav visibility.
 */
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @RequirePermission('channels.view')
  @Get()
  list(@Ctx() ctx: TenantContext): Promise<ChannelDto[]> {
    return this.channels.list(ctx);
  }

  @RequirePermission('channels.manage')
  @Post()
  create(
    @Ctx() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateChannelInput)) body: CreateChannelInputType,
  ): Promise<ChannelDto> {
    return this.channels.create(ctx, body);
  }

  @RequirePermission('channels.manage')
  @Patch(':id')
  update(
    @Ctx() ctx: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateChannelInput)) body: UpdateChannelInputType,
  ): Promise<ChannelDto> {
    return this.channels.update(ctx, id, body);
  }
}
