import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@dokane/contracts';
import { Public } from './common/decorators';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
