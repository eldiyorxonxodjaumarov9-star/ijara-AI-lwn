import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Server holatini tekshirish' })
  health() {
    return {
      status: 'ok',
      service: 'arendahub-api',
      timestamp: new Date().toISOString(),
    };
  }
}
