import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from './database.service';

import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
    @Req() request: Request,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const userId = request.auth.payload.sub.toString();
    return this.databaseSourceService.syncDatasource(userId, projectId);
  }
}
