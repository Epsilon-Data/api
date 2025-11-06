import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

import { Resource } from 'src/common/decorators/resource.decorator';
import { ResourceGuard } from 'src/common/guards/resource.guard';
import { Scopes } from 'src/common/decorators/scopes.decorator';

@ApiTags('Database')
@Controller('database')
@Resource('project')
export class DatabaseController {
  constructor(private databaseSourceService: DatabaseService) {}

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/summary')
  @ApiOperation({ summary: 'Get database summary' })
  async summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.summary(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/tables')
  @ApiOperation({ summary: 'Get database tables' })
  async tables(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.tables(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view')
  @Get(':projectId/columns')
  @ApiOperation({ summary: 'Get database columns' })
  async columns(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return await this.databaseSourceService.columns(projectId);
  }

  @UseGuards(ResourceGuard)
  @Scopes('view, connect')
  @Post(':projectId/sync')
  @ApiOperation({ summary: 'Sync Database' })
  syncDatasource(
    @CurrentUser() user: CurrentUserInfo,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.databaseSourceService.syncDatasource(user.id, projectId);
  }
}
