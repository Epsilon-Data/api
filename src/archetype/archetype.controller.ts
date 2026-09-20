import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import {
  ArchetypeDto,
  ArchetypeSuggestionDto,
  ArchetypeSummaryDto,
  ArchetypeValidationResultDto,
  UpdateArchetypeAttributesDto,
} from './dto';
import { Request } from 'express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { GenericErrorResponseDto } from 'src/common/dto';

@ApiTags('Archetype')
@ApiBearerAuth()
@Controller('archetype')
@Resource('project')
export class ArchetypeController {
  private readonly logger = new Logger(ArchetypeController.name);
  constructor(private readonly archetypeService: ArchetypeService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get list of archetypes for a project' })
  @ApiOkResponse({
    description: 'List of Archetypes for project returned',
    type: ArchetypeSummaryDto,
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
    description: 'Project archetypes or underlying Atlas entity not found',
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
  async fetchArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.archetypeService.fetchArchetypes(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Get(':projectId/suggestions')
  @ApiOperation({
    summary: 'Suggest archetypes that can be built from the crawled schema',
    description:
      'Each suggestion follows foreign keys from one table to the tables it references, so it is joinable and never multiplies rows. Join keys and identifier-like columns are left out.',
  })
  @ApiOkResponse({ type: [ArchetypeSuggestionDto] })
  suggestArchetypes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.archetypeService.suggestArchetypes(projectId);
  }

  @Get(':projectId/published')
  @ApiOperation({ summary: 'Get project published archetype details' })
  @ApiOkResponse({
    description: 'Archetypes details returned',
    type: ArchetypeDto,
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
  async getPublishedArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return await this.archetypeService.getPublishedArchetype(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Get project archetype details' })
  @ApiOkResponse({
    description: 'Archetypes details returned',
    type: ArchetypeDto,
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
  async getArchetypeDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return await this.archetypeService.getArchetypeDetails(
      projectId,
      archetypeId,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Patch(':projectId/:archetypeId')
  @ApiOperation({ summary: 'Update archetype details for a project' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Archetype details updated',
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
  @ApiUnprocessableEntityResponse({
    description:
      'Archetype has validation errors and cannot be published (see issues)',
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
  updateArchetypeDetails(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
    @Body() attributes: UpdateArchetypeAttributesDto,
  ) {
    return this.archetypeService.updateArchetypeDetails(
      projectId,
      archetypeId,
      attributes,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Post(':projectId/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate an archetype against the crawled database schema',
    description:
      'Checks tree structure, column references, foreign key joinability and identifier exposure without saving anything.',
  })
  @ApiOkResponse({ type: ArchetypeValidationResultDto })
  validateArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() archetype: ArchetypeDto,
  ) {
    return this.archetypeService.validateArchetype(projectId, archetype);
  }

  // rest of these will go through queue implementation
  // TODO: add proper API error responses
  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Post(':projectId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype creation accepted for processing',
  })
  createArchetype(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() archetype: ArchetypeDto,
  ) {
    return this.archetypeService.createArchetype(user.id, projectId, archetype);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Put(':projectId/:archetypeId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Update archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype update accepted for processing',
  })
  updateArchetype(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
    @Body() archetype: ArchetypeDto,
  ) {
    return this.archetypeService.updateArchetype(
      user.username,
      projectId,
      archetypeId,
      archetype,
    );
  }

  @UseGuards(ResourceGuard)
  @Scopes('view', 'edit')
  @Delete(':projectId/:archetypeId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Delete archetype for a project' })
  @ApiAcceptedResponse({
    description: 'Archetype delete accepted for processing',
  })
  async deleteArchetype(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('archetypeId') archetypeId: string,
  ) {
    return await this.archetypeService.deleteArchetype(projectId, archetypeId);
  }
}
