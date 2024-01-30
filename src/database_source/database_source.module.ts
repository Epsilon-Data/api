import { Module } from '@nestjs/common';
import { DatabaseSourceController } from './database_source.controller';
import { DatabaseSourceService } from './database_source.service';

@Module({
  controllers: [DatabaseSourceController],
  providers: [DatabaseSourceService],
})
export class DatabaseSourceModule {}
