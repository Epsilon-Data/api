import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  ParseUUIDPipe,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  Query,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectDto, SettingsDto } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/options';

@ApiTags('Project')
@Controller('project')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of projects for logged in user' })
  // TODO: this needs to get all projects that user is associated with (owner or collaborator)
  async getList(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.projectService.getList(userId);
  }

  @Get(':projectId/requests')
  @ApiOperation({ summary: 'Get list of incoming requests' })
  async getRequestList(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const email = request.auth.payload.email.toString();
    return await this.projectService.getRequestList(projectId, email);
  }

  @Post()
  @ApiOperation({ summary: 'Create project' })
  create(@Body() dto: ProjectDto) {
    return this.projectService.create(dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  async getDetails(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.projectService.getDetails(projectId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Edit project' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ProjectDto,
  ) {
    return this.projectService.update(projectId, dto);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  delete(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectService.delete(projectId);
  }

  @Get(':projectId/settings')
  @ApiOperation({ summary: 'Get project settings' })
  async getSettings(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.projectService.getSettings(projectId);
  }

  @Put(':projectId/settings')
  @ApiOperation({ summary: 'Update project settings' })
  async updateSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateSettings(projectId, dto);
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  async uploadCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.projectService.uploadCover(projectId, file);
    return result;
  }

  // @Get(':projectId/summary')
  // async projectSummary(@Param('projectId', ParseUUIDPipe) projectId: string) {
  //   return await this.projectService.projectSummary(projectId);
  // }

  // @Get(':requestId')
  // details(@Param('requestId', ParseUUIDPipe) requestId: string) {
  //   return this.connectionRequestService.details(requestId);
  // }
}
