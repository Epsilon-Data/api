import { forwardRef, Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { DatabaseSourceModule } from 'src/database_source/database_source.module';

@Module({
  imports: [forwardRef(() => DatabaseSourceModule)],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
