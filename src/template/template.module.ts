import { forwardRef, Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { DatasourceModule } from 'src/datasource/datasource.module';

@Module({
  imports: [forwardRef(() => DatasourceModule)],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
