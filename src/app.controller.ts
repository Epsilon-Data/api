import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller('app')
export class AppController {
  constructor() {}

  @ApiOperation({ summary: 'Get application health information' })
  @Get('health')
  @ApiOkResponse({
    description: 'Status of API',
  })
  getHealth() {
    return { status: 'OK', title: 'Epsilon API Hub' };
  }
}
