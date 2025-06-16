import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get('health')
  getHealth() {
    return { status: 'OK', title: 'Epsilon API Hub' };
  }
}
