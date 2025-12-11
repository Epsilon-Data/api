import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import {
  AnalysisArchetypeResponseDto,
  AuthTokenResponseDto,
  DatasetDto,
  LoginDto,
} from './dto/analysis.dto';
import { ArchetypeService } from 'src/archetype/archetype.service';
import { Resource } from 'src/common/decorators/resource.decorator';
import { GenericErrorResponseDto } from 'src/common/dto';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { AnalysisRequestService } from 'src/analysis-request/analysis-request.service';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { Scopes } from 'src/common/decorators/scopes.decorator';

@ApiTags('Analysis')
@ApiBearerAuth()
@Controller('analysis')
@Resource('project')
export class AnalysisController {
  constructor(
    private readonly archetypeService: ArchetypeService,
    private readonly keycloakService: KeycloakAdminService,
    private readonly analysisRequestService: AnalysisRequestService,
  ) {}

  @Public()
  @Post('auth')
  @ApiOperation({ summary: 'Get access token for SDK (Public endpoint)' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'List of user owned projects are returned',
    type: AuthTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
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
  @ApiOperation({ summary: 'Get list of all projects for logged in user' })
  @ApiOkResponse({
    description: 'List of analysis datasets',
    type: DatasetDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 401,
          message: 'No authorisation found',
          error: 'Unauthorized Request',
        },
      },
    },
  })
  async getUserDatasets(@CurrentUser() user: CurrentUserInfo) {
    return await this.analysisRequestService.getAnalysisProjects(user.id);
  }

  @UseGuards(ResourceGuard)
  @Scopes('analysis')
  @Get('datasets/:projectId')
  @ApiOperation({ summary: 'Get archetype for a dataset' })
  @ApiOkResponse({
    description: 'Archetype Json Schema returned',
    type: AnalysisArchetypeResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 401,
          message: 'No authorisation found',
          error: 'Unauthorized Request',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Archetype or underlying Atlas entity not found',
    type: GenericErrorResponseDto,
    schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
    example: {
      statusCode: 404,
      message: 'Requested resource could not be found',
      error: 'MetadataServiceError',
    },
  })
  async getDatasetArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.archetypeService.getAnalysisArchetype(projectId);
  }
}
