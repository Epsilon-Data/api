import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { DatabaseSourceService } from './database_source.service';
import { TemplateDto } from './dto';

@Controller('database-source')
export class DatabaseSourceController {
  constructor(private databaseSourceService: DatabaseSourceService) {}

  @Get('list')
  list(@Req() request) {
    return this.databaseSourceService.list(request);
  }

  @Get('project-id')
  getProjectId(@Query('id') projectId: string) {
    return this.databaseSourceService.getProjectId(projectId);
  }

  @Get('summary')
  summary(@Query('projectId') projectId: string) {
    return this.databaseSourceService.summary(projectId);
  }

  @Get('tables')
  tables(@Query('projectId') projectId: string) {
    return this.databaseSourceService.tables(projectId);
  }

  @Post('add-template')
  addTemplate(@Body() template: TemplateDto) {
    return this.databaseSourceService.addTemplate(template);
  }

  @Get('template')
  template(@Query('projectId') projectId: string) {
    return this.databaseSourceService.template(projectId);
  }

  @Post('add-column-mapping')
  addColumnMapping(@Body() template: TemplateDto) {
    return this.databaseSourceService.addColumnMapping(template);
  }

  @Get('columns')
  columns(@Query('projectId') projectId: string) {
    return this.databaseSourceService.columns(projectId);
  }
}
