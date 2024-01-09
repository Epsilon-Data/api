import { Module } from '@nestjs/common';
import { DatabaseSourceController } from './database-source.controller';
import { DatabaseSourceService } from './database-source.service';

@Module({
  controllers: [DatabaseSourceController],
  providers: [DatabaseSourceService]
})
export class DatabaseSourceModule {}
