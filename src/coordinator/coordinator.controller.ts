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
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import { Resource } from 'src/common/decorators/resource.decorator';
import { DatabaseService } from 'src/database/database.service';
import { AuthTokenResponseDto } from 'src/analysis/dto';
import { GenericErrorResponseDto } from 'src/common/dto';
import { ClientLoginDto } from './dto';
import { ScopesGuard } from 'src/common/guards/scopes.guard';
import { DatasetDetailsResponseDto } from 'src/database/dto';

@ApiTags('Coordinator')
@ApiBearerAuth()
@Controller('coordinator')
@Resource('project')
export class CoordinatorController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly keycloakService: KeycloakAdminService,
  ) {}

  @Public()
  @Post('auth')
  @ApiOperation({
    summary:
      'Get access token for internal coordinator client (Public endpoint)',
  })
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
  async getAccessToken(@Body() login: ClientLoginDto) {
    return await this.keycloakService.getAccessTokenClient(login);
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
