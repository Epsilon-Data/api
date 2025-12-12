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
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  AnalysisArchetypeResponseDto,
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
import { KeycloakTokenResponseDto } from 'src/auth/dto';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { Credentials } from '@epsilon-data/keycloak-admin-client';
import { ConfigService } from '@nestjs/config';

@ApiTags('Analysis')
@ApiBearerAuth()
@Controller('analysis')
@Resource('project')
export class AnalysisController {
  constructor(
    private readonly archetypeService: ArchetypeService,
    private readonly keycloakService: KeycloakService,
    private readonly analysisRequestService: AnalysisRequestService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('auth')
  @ApiOperation({ summary: 'Get access token for SDK (Public endpoint)' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Access token response is returned',
    type: KeycloakTokenResponseDto,
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
  @ApiInternalServerErrorResponse({
    description: 'Authorisation service error',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
        example: {
          statusCode: 500,
          message: 'Authorisation service is currently unavailable',
          error: 'AuthorisationServiceError',
        },
      },
    },
  })
  async getAccessToken(@Body() login: LoginDto) {
    const credentials: Credentials = {
      grantType: login.password ? 'password' : 'refresh_token',
      clientId: this.configService.get<string>('sdk.clientId')!,
      username: login.username,
      password: login.password,
      refreshToken: login.refreshToken,
    };
    return await this.keycloakService.getAccessToken(credentials);
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
