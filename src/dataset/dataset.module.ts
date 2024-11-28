import { Module } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';
import { DatasourceService } from 'src/datasource/datasource.service';
import { TemplateModule } from 'src/template/template.module';

@Module({
  imports: [TemplateModule],
  providers: [DatasetService, DatasourceService],
  controllers: [DatasetController],
})
export class DatasetModule {}
