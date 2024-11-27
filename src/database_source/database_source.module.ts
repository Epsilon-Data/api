import { forwardRef, Module } from '@nestjs/common';
import { DatabaseSourceController } from './database_source.controller';
import { DatabaseSourceService } from './database_source.service';
import { DatabaseSourceGateway } from './database_source.gateway';
import { TemplateModule } from 'src/template/template.module';

@Module({
  imports: [forwardRef(() => TemplateModule)],
  controllers: [DatabaseSourceController],
  providers: [DatabaseSourceService, DatabaseSourceGateway],
  exports: [DatabaseSourceService],
})
export class DatabaseSourceModule {}
