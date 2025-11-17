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
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import {
  ProjectDetailsResponseDto,
  CreateProjectDto,
  ProjectRequestsResponse,
  ProjectSummaryInfoDto,
  SettingsDto,
  SettingsResponseDto,
  UpdateProjectDto,
} from './dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { coverOptions } from 'src/utils/options.util';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import type { Request } from 'express';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { ErrorResponseDto } from 'src/common/dto';

@ApiTags('Project')
@ApiBearerAuth()
@Controller('project')
@Resource('project')
export class ProjectController {
  constructor(
    private projectService: ProjectService,
    private keycloakConnect: KeycloakService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project created successfully',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async createProject(
    @CurrentUser() user: CurrentUserInfo,
    @Body() dto: CreateProjectDto,
  ) {
    // TODO: we need to make sure that we actually use usernames because these will be needed for atlas authorization as emails will change which break ownership lookups and Ranger policies
    return await this.projectService.createProject(user, dto);
  }

  @Get('')
  @ApiOperation({ summary: 'Get list of projects owned by logged in user' })
  @ApiOkResponse({
    description: 'List of user owner projects are returned',
    type: ProjectSummaryInfoDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async getUserOwnedProjects(@CurrentUser() user: CurrentUserInfo) {
    return await this.projectService.getUserOwnedProjects(user.id);
  }

  @Get('shared')
  @ApiOperation({ summary: 'Get list of projects user is collaborator on' })
  @ApiOkResponse({
    description: 'List of collaborator projects are returned',
    type: ProjectSummaryInfoDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getUserSharedProjects(@Req() request: Request) {
    // check for user resource permissions against keycloak
    // TODO: perhaps call this once and cache or make it into a helper/decorator
    const authzRequest = {
      response_mode: 'permissions',
    };
    const permissions = await this.keycloakConnect.getPermissions(
      authzRequest,
      request,
    );
    return await this.projectService.getUserSharedProjects(permissions);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get list of all projects' })
  @ApiOkResponse({
    description: 'List of all projects',
    type: ProjectSummaryInfoDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getAllProjects() {
    return await this.projectService.getAllProjects();
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/requests')
  @ApiOperation({ summary: 'Get list of incoming requests' })
  @ApiOkResponse({
    description: 'List of analysis and connection requests for the projects',
    type: ProjectRequestsResponse,
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getProjectRequests(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectRequests(projectId, user.email);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  @ApiOkResponse({
    description: 'Project details are returned',
    type: ProjectDetailsResponseDto,
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getProjectDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectDetails(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Put(':projectId')
  @ApiOperation({ summary: 'Edit project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project details updated',
  })
  updateProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(projectId, dto);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, edit, delete')
  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project deleted',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  deleteProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projectService.deleteProject(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/settings')
  @ApiOperation({ summary: 'Get project settings' })
  @ApiOkResponse({
    description: 'Project settings are returned',
    type: SettingsResponseDto,
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectSettings(projectId);
  }

  // TODO: need to see if this is needed
  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Post(':projectId/settings')
  @ApiOperation({ summary: 'Add project settings' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project settings are added',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async addProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateProjectSettings(projectId, dto);
  }

  // TODO: need to see if this is needed
  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Put(':projectId/settings')
  @ApiOperation({ summary: 'Update project settings' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project settings are updated',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async updateProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateProjectSettings(projectId, dto);
  }

  // TODO: this needs refactoring, is it used?
  @UseGuards(ResourceGuard)
  @Scopes('view, edit')
  @Post(':projectId/upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  @ApiNoContentResponse({
    description: 'Project cover image is returned',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  async uploadProjectCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.projectService.uploadProjectCover(projectId, file);
    return result;
  }
}
