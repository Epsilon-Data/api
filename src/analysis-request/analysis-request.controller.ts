import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  ParseUUIDPipe,
  Patch,
  Param,
  Post,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AnalysisRequestService } from './analysis-request.service';
import {
  AnalysisDecisionDto,
  AnalysisDto,
  AnalysisRequestDetailsResponseDto,
  AnalysisRequestSummaryInfoDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNoContentResponse,
  getSchemaPath,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';
import { Resource } from 'src/common/decorators/resource.decorator';
import { Scopes } from 'src/common/decorators/scopes.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { GenericErrorResponseDto } from 'src/common/dto';
import { RequestCommentDto } from 'src/connection_request/dto';

@ApiTags('Analysis Request')
@ApiBearerAuth()
@Controller('analysis-request')
@Resource('project')
export class AnalysisRequestController {
  constructor(private analysisRequestService: AnalysisRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create analysis request' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Analysis request created successfully',
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
  createRequest(
    @CurrentUser() user: CurrentUserInfo,
    @Body() dto: AnalysisDto,
  ) {
    return this.analysisRequestService.createRequest(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get list of analysis requests sent',
  })
  @ApiOkResponse({
    description: 'List of user owned request are returned',
    type: AnalysisRequestSummaryInfoDto,
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
  async getList(@CurrentUser() user: CurrentUserInfo) {
    return await this.analysisRequestService.getList(user.id);
  }

  @Get(':requestId')
  @ApiOperation({
    summary: 'Get analysis request details',
  })
  @ApiOkResponse({
    description: 'List of user owned request are returned',
    type: AnalysisRequestDetailsResponseDto,
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
  async getDetails(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return await this.analysisRequestService.getDetails(user.id, requestId);
  }

  // TODO: should this not also have to be reject?
  @UseGuards(ResourceGuard)
  @Scopes('view, approve')
  @Patch(':projectId/:requestId')
  @ApiOperation({
    summary: 'Approve analysis request',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Analysis request approved',
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
  approve(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: AnalysisDecisionDto,
  ) {
    return this.analysisRequestService.approve(requestId, dto);
  }

  @Put(':requestId')
  @ApiOperation({
    summary: 'Update analysis request',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Analysis request updated successfully',
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
    description: 'Request not found or not owned by user',
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
  async update(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: AnalysisDto,
  ) {
    return await this.analysisRequestService.update(user.id, requestId, dto);
  }

  @Delete(':requestId')
  @ApiOperation({
    summary: 'Delete analysis request',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Analysis request deleted successfully',
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
          message: 'Request not found or not owned by user',
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
  async delete(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return await this.analysisRequestService.delete(user.id, requestId);
  }

  @Post(':requestId/comment')
  @ApiOperation({ summary: 'Create comment for analysis request' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Comment created successfully',
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
  createComment(
    @CurrentUser() user: CurrentUserInfo,
    @Body() dto: RequestCommentDto,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.analysisRequestService.createComment(user.id, requestId, dto);
  }

  @Get(':requestId/comment')
  @ApiOperation({
    summary: 'Get comments of analysis request',
  })
  @ApiOkResponse({
    description: 'List of user owned request are returned',
    type: AnalysisRequestDetailsResponseDto,
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
  async getComments(
    @CurrentUser() user: CurrentUserInfo,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return await this.analysisRequestService.getComments(user.id, requestId);
  }
}
