import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { Resource } from 'src/common/decorators/resource.decorator';
import { DatabaseService } from 'src/database/database.service';
import { GenericErrorResponseDto } from 'src/common/dto';
import { ClientLoginDto } from './dto';
import { ScopesGuard } from 'src/common/guards/scopes.guard';
import { DatasetDetailsResponseDto } from 'src/database/dto';
import { KeycloakService } from 'src/auth/keycloak/keycloak.service';
import { Credentials } from '@epsilon-data/keycloak-admin-client';
import { ConfigService } from '@nestjs/config';
import { KeycloakTokenResponseDto } from 'src/auth/dto';
import { AnalysisDecisionDto } from 'src/analysis-request/dto';
import { AnalysisRequestService } from 'src/analysis-request/analysis-request.service';

@ApiTags('Coordinator')
@ApiBearerAuth()
@Controller('coordinator')
@Resource('project')
export class CoordinatorController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly keycloakService: KeycloakService,
    private readonly analysisRequestService: AnalysisRequestService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('auth')
  @ApiOperation({
    summary:
      'Get access token for internal coordinator client (Public endpoint)',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Access token object is returned',
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
  async getAccessToken(@Body() login: ClientLoginDto) {
    const credentials: Credentials = {
      grantType: 'client_credentials',
      clientId:
        login.clientId ??
        this.configService.get<string>('coordinator.clientId'),
      clientSecret: login.clientSecret,
    };
    return await this.keycloakService.getAccessToken(credentials);
  }

  @Get(':projectId')
  @UseGuards(new ScopesGuard('epsilon.coordinator'))
  @ApiOperation({ summary: 'Check user access to project analysis' })
  @ApiOkResponse({
    description: 'Project analysis decision returned',
    type: AnalysisDecisionDto,
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
    description: 'Request not found',
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
  async checkAccess(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('userId') userId: string,
  ) {
    return await this.analysisRequestService.checkAnalysisAccess(
      projectId,
      userId,
    );
  }

  @Get(':projectId/:archetypeId')
  @UseGuards(new ScopesGuard('epsilon.coordinator'))
  @ApiOperation({ summary: 'Get project archetype dataset details' })
  @ApiOkResponse({
    description: 'Project published archetype dataset details returned',
    type: DatasetDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request to metadata service',
    type: GenericErrorResponseDto,
    schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
    example: {
      statusCode: 400,
      message: 'Invalid request to metadata service',
      error: 'MetadataServiceError',
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
  @ApiInternalServerErrorResponse({
    description: 'Upstream Atlas / metadata service error',
    type: GenericErrorResponseDto,
    schema: { $ref: getSchemaPath(GenericErrorResponseDto) },
    example: {
      statusCode: 500,
      message: 'Metadata service is currently unavailable',
      error: 'MetadataServiceError',
    },
  })
  async getDatasetDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return this.databaseService.getDatasetDetails(projectId, archetypeId);
  }
}
