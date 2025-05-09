import { forwardRef, Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [forwardRef(() => DatabaseModule)],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
