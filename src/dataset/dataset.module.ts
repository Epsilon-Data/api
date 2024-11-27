import { Module } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';
import { DatabaseSourceService } from 'src/database_source/database_source.service';
import { TemplateModule } from 'src/template/template.module';

@Module({
  imports: [TemplateModule],
  providers: [DatasetService, DatabaseSourceService],
  controllers: [DatasetController],
})
export class DatasetModule {}
