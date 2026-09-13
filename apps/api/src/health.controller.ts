import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@dokane/contracts';

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
