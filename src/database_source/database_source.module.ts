import { Module } from '@nestjs/common';
import { DatabaseSourceController } from './database_source.controller';
import { DatabaseSourceService } from './database_source.service';
import { DatabaseSourceGateway } from './database_source.gateway';

@Module({
  controllers: [DatabaseSourceController],
  providers: [DatabaseSourceService, DatabaseSourceGateway],
})
export class DatabaseSourceModule {}
