import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { DatabaseSourceService } from './database_source.service';
import { TemplateDto } from './dto';

@Controller('database-source')
export class DatabaseSourceController {
  constructor(private databaseSourceService: DatabaseSourceService) {}

  @Get('list')
  list(@Query('userId', ParseIntPipe) userId: number) {
    return this.databaseSourceService.list(userId);
  }

  @Get('summary')
  summary(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.databaseSourceService.summary(projectId);
  }

  @Get('tables')
  tables(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.databaseSourceService.tables(projectId);
  }

  @Post('add-template')
  addTemplate(@Body() template: TemplateDto) {
    console.log(template);
    return this.databaseSourceService.addTemplate(template);
  }

  @Get('columns')
  columns(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.databaseSourceService.columns(projectId);
  }
}
