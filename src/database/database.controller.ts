import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

import { Resource } from 'src/common/decorators/resource.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import {
  DatabaseSummaryResponseDto,
  DatabaseTableDto,
  TableColumnRefDto,
} from './dto';
import { GenericErrorResponseDto } from 'src/common/dto';

@ApiTags('Database')
@ApiBearerAuth()
@Controller('database')
@Resource('project')
export class DatabaseController {
  constructor(private databaseSourceService: DatabaseService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/summary')
  @ApiOperation({ summary: 'Get database summary' })
  @ApiOkResponse({
    description: 'Summary details for database returned',
    type: DatabaseSummaryResponseDto,
    isArray: true,
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
    description: 'Project database or underlying Atlas entity not found',
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
  async summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.summary(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/tables')
  @ApiOperation({ summary: 'Get database tables' })
  @ApiOkResponse({
    description: 'Database tables details returned',
    type: DatabaseTableDto,
    isArray: true,
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
    description: 'Project database tables or underlying Atlas entity not found',
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
  async tables(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.tables(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/columns')
  @ApiOperation({ summary: 'Get database columns' })
  @ApiOkResponse({
    description: 'Database columns details returned',
    type: TableColumnRefDto,
    isArray: true,
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
    description:
      'Project database columns or underlying Atlas entity not found',
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
  async columns(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.columns(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, connect')
  @Post(':projectId/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Sync Database' })
  @ApiAcceptedResponse({
    description: 'Sync database request accepted for processing',
  })
  syncDatasource(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.databaseSourceService.syncDatasource(user.id, projectId);
  }
}
