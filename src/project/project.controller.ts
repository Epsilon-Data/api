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
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
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
import { GenericErrorResponseDto } from 'src/common/dto';

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
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Database constraint conflict (e.g. unique violation)',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 409,
          message: 'Conflict while performing database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async createProject(
    @Req() request: Request,
    @CurrentUser() user: CurrentUserInfo,
    @Body() dto: CreateProjectDto,
  ) {
    return await this.projectService.createProject(
      user,
      dto,
      request.auth?.token || '',
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get list of projects owned by logged in user' })
  @ApiOkResponse({
    description: 'List of user owned projects are returned',
    type: ProjectSummaryInfoDto,
    isArray: true,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
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
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
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
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
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
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Project not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async getProjectRequests(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectRequests(
      projectId,
      user.id,
      user.email,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  @ApiOkResponse({
    description: 'Project details are returned',
    type: ProjectDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Project not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async getProjectDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectDetails(projectId);
  }

  @Get(':projectId/public')
  @ApiOperation({ summary: 'Get project public details' })
  @ApiOkResponse({
    description: 'Project details are returned',
    type: ProjectDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Project not found',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 404,
          message: 'Requested resource could not be found',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async getProjectPublicDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectPublicDetails(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Put(':projectId')
  @ApiOperation({ summary: 'Edit project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project details updated',
  })
  updateProject(
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(
      projectId,
      dto,
      request.auth?.token || '',
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit', 'delete')
  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project deleted',
  })
  @ApiNotFoundResponse({ type: GenericErrorResponseDto })
  @ApiBadRequestResponse({ type: GenericErrorResponseDto })
  @ApiConflictResponse({ type: GenericErrorResponseDto })
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
  @ApiNotFoundResponse({ type: GenericErrorResponseDto })
  @ApiBadRequestResponse({ type: GenericErrorResponseDto })
  async getProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.projectService.getProjectSettings(projectId);
  }

  // TODO: need to see if this is needed
  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Post(':projectId/settings')
  @ApiOperation({ summary: 'Add project settings' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project settings are added',
  })
  @ApiNotFoundResponse({ type: GenericErrorResponseDto })
  @ApiBadRequestResponse({ type: GenericErrorResponseDto })
  @ApiConflictResponse({ type: GenericErrorResponseDto })
  async addProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateProjectSettings(projectId, dto);
  }

  // TODO: need to see if this is needed
  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Put(':projectId/settings')
  @ApiOperation({ summary: 'Update project settings' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Project settings are updated',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Database constraint conflict (e.g. unique violation)',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 409,
          message: 'Conflict while performing database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async updateProjectSettings(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: SettingsDto,
  ) {
    return await this.projectService.updateProjectSettings(projectId, dto);
  }

  // TODO: this needs refactoring, is it used?
  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Post(':projectId/upload-cover')
  @UseInterceptors(FileInterceptor('file', coverOptions))
  @ApiNoContentResponse({
    description: 'Project cover image is returned',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 400,
          message: 'Invalid request data for database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Database constraint conflict (e.g. unique violation)',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 409,
          message: 'Conflict while performing database operation',
          error: 'DatabaseError',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected database error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Database is temporarily unavailable',
          error: 'DatabaseError',
        },
      },
    },
  })
  async uploadProjectCover(
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const result = this.projectService.uploadProjectCover(projectId, file);
    return result;
  }
}
