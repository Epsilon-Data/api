import {
  Body,
  Controller,
  Delete,
  Get,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatabaseSourceService } from './database_source.service';
import { PermissionsDto, TemplateDto } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/options';

@Controller('database-source')
export class DatabaseSourceController {
  constructor(private databaseSourceService: DatabaseSourceService) {}

  @Get('list')
  list(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.databaseSourceService.list(userId);
  }

  @Get('project-id')
  getProjectId(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.getProjectId(projectId);
  }

  @Get('summary')
  summary(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.summary(projectId);
  }

  @Get('tables')
  tables(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.tables(projectId);
  }

  @Get('template-names')
  templateNames(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.templateNames(projectId);
  }

  @Get('templates')
  templates(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.templates(projectId);
  }

  @Post('delete-template')
  deleteTemplate(@Body() template: TemplateDto) {
    return this.databaseSourceService.deleteTemplate(template);
  }

  @Post('add-archetype')
  addArchetype(@Body() template: TemplateDto) {
    return this.databaseSourceService.addArchetype(template);
  }

  @Get('columns')
  columns(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.columns(projectId);
  }

  @Get('permissions')
  permissions(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.permissions(projectId);
  }

  @Post('add-permissions')
  addPermissions(@Body() permissions: PermissionsDto) {
    return this.databaseSourceService.addPermissions(permissions);
  }

  @Get('settings')
  settings(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.settings(projectId, {
      cover: true,
      visualisations: true,
    });
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  async uploadCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    // return { response: 'asdf' };
    return this.databaseSourceService.uploadCover(projectId, file);
  }

  @Post('upload-vis')
  uploadVis(@Body() visualisations: { projectId: string; vis: string }) {
    return this.databaseSourceService.uploadVis(visualisations);
  }

  @Delete('delete-cover')
  deleteCover(@Query('projectId', ParseUUIDPipe) projectId: string) {
    return this.databaseSourceService.deleteCover(projectId);
  }
}
