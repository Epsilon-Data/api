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
  // UseGuards,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectDto, SettingsDto } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/options';

// import { Resource } from 'src/common/decorators/resource.decorator';
// import { Scopes } from 'src/common/decorators/scopes.decorator';
// import { ResourceGuard } from 'src/common/guards/resource.guard';

@ApiTags('Project')
@Controller('project')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of projects for logged in user' })
  // TODO: this needs to get all projects that user is associated with (owner or collaborator)
  async getUserProjects(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return await this.projectService.getUserProjects(userId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get list of all projects' })
  async getAllProjects() {
    return await this.projectService.getAllProjects();
  }

  // NOTE: example usage of resource guard
  // @Resource('Project')
  // @UseGuards(ResourceGuard)
  // @Scopes('view,edit')
  @Get(':projectId/requests')
  @ApiOperation({ summary: 'Get list of incoming requests' })
  async getProjectRequests(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const email = request.auth.payload.email.toString();
    return await this.projectService.getProjectRequests(projectId, email);
  }

  @Post()
  @ApiOperation({ summary: 'Create project' })
  createProject(@Body() dto: ProjectDto) {
    return this.projectService.createProject(dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  async getProjectDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectDetails(projectId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Edit project' })
  updateProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ProjectDto,
  ) {
    return this.projectService.updateProject(projectId, dto);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  deleteProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectService.deleteProject(projectId);
  }

  @Get(':projectId/settings')
  @ApiOperation({ summary: 'Get project settings' })
  async getProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectSettings(projectId);
  }

  @Put(':projectId/settings')
  @ApiOperation({ summary: 'Update project settings' })
  async updateProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateProjectSettings(projectId, dto);
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  async uploadProjectCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.projectService.uploadProjectCover(projectId, file);
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
