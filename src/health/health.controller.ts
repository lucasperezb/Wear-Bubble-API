import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@ApiTags('Health')
@SkipThrottle()
export class HealthController {
  @Get()
  health() {
    return { ok: true, service: 'bubble-store-backend', framework: 'nestjs' };
  }
}
