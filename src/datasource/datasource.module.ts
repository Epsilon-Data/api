import { forwardRef, Module } from '@nestjs/common';
import { DatasourceController } from './datasource.controller';
import { DatasourceService } from './datasource.service';
import { DatasourceGateway } from './datasource.gateway';
import { TemplateModule } from 'src/template/template.module';

@Module({
  imports: [forwardRef(() => TemplateModule)],
  controllers: [DatasourceController],
  providers: [DatasourceService, DatasourceGateway],
  exports: [DatasourceService],
})
export class DatasourceModule {}
