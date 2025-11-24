import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { ProjectService } from 'src/project/project.service';
import { AuthTokenResponseDto, LoginDto } from './dto/analysis.dto';
import { ArchetypeService } from 'src/archetype/archetype.service';
import type { Request } from 'express';
import { Resource } from 'src/common/decorators/resource.decorator';
import { GenericErrorResponseDto } from 'src/common/dto';

@ApiTags('Analysis')
@ApiBearerAuth()
@Controller('analysis')
@Resource('project')
export class AnalysisController {
  constructor(
    private readonly archetypeService: ArchetypeService,
    private readonly keycloakService: KeycloakAdminService,
    private readonly projectService: ProjectService,
    private readonly keycloakConnect: KeycloakService,
  ) {}

  @Post('auth')
  @ApiOperation({ summary: 'Get access token for SDK' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'List of user owned projects are returned',
    type: AuthTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid request data for database operation',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 401,
          message: 'Invalid user credentials',
          error: 'AuthorisationServiceError',
        },
      },
    },
  })
  async getAccessToken(@Body() login: LoginDto) {
    return await this.keycloakService.getAccessToken(login);
  }

  @Get('datasets')
  // TODO: check if they have analysis scope for this and SDK scope
  @ApiOperation({ summary: 'Get list of all projects for logged in user' })
  async getUserDatasets(@Req() request: Request) {
    // check for user resource permissions
    // TODO: perhaps call this once and cache
    const authzRequest = {
      response_mode: 'permissions',
    };
    const permissions = await this.keycloakConnect.getPermissions(
      authzRequest,
      request,
    );
    if (permissions)
      //TODO: need a different query for the project to get info for SDK
      return await this.projectService.getUserSharedProjects(permissions);
  }

  @Get('datasets/:projectId')
  // TODO: check if they have analysis scope for this and SDK scope
  @ApiOperation({ summary: 'Get archetype for a dataset' })
  async getDatasetArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.archetypeService.getAnalysisArchetype(projectId);
  }
}
