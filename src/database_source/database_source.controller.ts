import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DatabaseSourceService } from './database_source.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/options';

@Controller('database-source')
export class DatabaseSourceController {
  constructor(private databaseSourceService: DatabaseSourceService) {}

  @Get()
  async list(@Query('userId', ParseUUIDPipe) userId: string) {
    return await this.databaseSourceService.list(userId);
  }

  @Get(':projectId')
  async getProjectId(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.getProjectId(projectId);
  }

  @Get(':projectId/summary')
  async summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.summary(projectId);
  }

  @Get(':projectId/tables')
  async tables(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.tables(projectId);
  }

  @Get(':projectId/columns')
  async columns(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.columns(projectId);
  }

  @Get(':projectId/permissions')
  async permissions(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.permissions(projectId);
  }

  @Post(':projectId/permissions')
  addPermissions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() permissions: string,
  ) {
    return this.databaseSourceService.addPermissions(projectId, permissions);
  }

  @Get('settings')
  settings(@Query('projectId', ParseUUIDPipe) projectId: string) {
    const result = this.databaseSourceService.settings(projectId, {
      cover: true,
      visualisations: true,
    });
    return result;
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  async uploadCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.databaseSourceService.uploadCover(projectId, file);
    return result;
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
