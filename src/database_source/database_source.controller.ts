import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatabaseSourceService } from './database_source.service';
import { PermissionsDto, TemplateDto } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Get('templates')
  templates(@Query('projectId') projectId: string) {
    return this.databaseSourceService.templates(projectId);
  }

  @Post('delete-template')
  deleteTemplate(@Body() template: TemplateDto) {
    return this.databaseSourceService.deleteTemplate(template);
  }

  @Post('add-column-mapping')
  addColumnMapping(@Body() template: TemplateDto) {
    return this.databaseSourceService.addColumnMapping(template);
  }

  @Get('columns')
  columns(@Query('projectId') projectId: string) {
    return this.databaseSourceService.columns(projectId);
  }

  @Get('permissions')
  permissions(@Query('projectId') projectId: string) {
    return this.databaseSourceService.permissions(projectId);
  }

  @Post('add-permissions')
  addPermissions(@Body() permissions: PermissionsDto) {
    return this.databaseSourceService.addPermissions(permissions);
  }

  @Get('settings')
  settings(@Query('projectId') projectId: string) {
    return this.databaseSourceService.settings(projectId, {
      cover: true,
      visualisations: true,
    });
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCover(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2000000 })],
      }),
    )
    file: Express.Multer.File,
    @Query('projectId') projectId: string,
  ) {
    console.log(file);
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
