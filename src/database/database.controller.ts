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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
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
