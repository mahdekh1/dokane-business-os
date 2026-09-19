import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateAppointmentInput, AppointmentListQuery, UpdateAppointmentInput, CALENDAR_PROVIDERS } from '@dokane/contracts';
import type {
  AppointmentDto,
  AppointmentListQuery as AppointmentListQueryType,
  AppointmentListResult,
  CalendarConnectionDto,
  CalendarProvider,
  CreateAppointmentInput as CreateAppointmentInputType,
  UpdateAppointmentInput as UpdateAppointmentInputType,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@RequireEntitlement('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @RequirePermission('calendar.appointments.view')
  @Get('appointments')
  list(@Ctx() ctx: TenantContext, @Query(new ZodValidationPipe(AppointmentListQuery)) q: AppointmentListQueryType): Promise<AppointmentListResult> {
    return this.calendar.list(ctx, q);
  }

  @RequirePermission('calendar.appointments.view')
  @Get('appointments/:id')
  get(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<AppointmentDto> {
    return this.calendar.get(ctx, id);
  }

  @RequirePermission('calendar.appointments.manage')
  @Post('appointments')
  create(@Ctx() ctx: TenantContext, @Body(new ZodValidationPipe(CreateAppointmentInput)) body: CreateAppointmentInputType): Promise<AppointmentDto> {
    return this.calendar.create(ctx, body);
  }

  @RequirePermission('calendar.appointments.manage')
  @Patch('appointments/:id')
  update(@Ctx() ctx: TenantContext, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateAppointmentInput)) body: UpdateAppointmentInputType): Promise<AppointmentDto> {
    return this.calendar.update(ctx, id, body);
  }

  @RequirePermission('calendar.connections.manage')
  @Get('connections')
  connections(@Ctx() ctx: TenantContext): Promise<CalendarConnectionDto[]> {
    return this.calendar.connections(ctx);
  }

  @RequirePermission('calendar.connections.manage')
  @Post('connections/:provider/connect')
  connect(@Ctx() ctx: TenantContext, @Param('provider') provider: string): Promise<never> {
    return this.calendar.connect(ctx, this.provider(provider));
  }

  @RequirePermission('calendar.connections.manage')
  @Post('connections/:provider/disconnect')
  disconnect(@Ctx() ctx: TenantContext, @Param('provider') provider: string): Promise<CalendarConnectionDto[]> {
    return this.calendar.disconnect(ctx, this.provider(provider));
  }

  private provider(p: string): CalendarProvider {
    if (!(CALENDAR_PROVIDERS as readonly string[]).includes(p)) throw new BadRequestException({ code: 'UNKNOWN_PROVIDER' });
    return p as CalendarProvider;
  }
}
