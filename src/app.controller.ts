import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller('app')
export class AppController {
  constructor() {}

  @ApiOperation({ summary: 'Get application health information' })
  @Get('health')
  getHealth() {
    return { status: 'OK', title: 'Epsilon API Hub' };
  }
}
