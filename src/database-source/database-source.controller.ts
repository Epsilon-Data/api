import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { DatabaseSourceService } from './database-source.service';

@Controller('database-source')
export class DatabaseSourceController {
  constructor(private databaseSourceService: DatabaseSourceService) {}

  @Get('list')
  list(@Query('userId', ParseIntPipe) userId: number) {
    return this.databaseSourceService.list(userId);
  }
}
