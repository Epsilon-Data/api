import { forwardRef, Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { DatabaseGateway } from './database.gateway';
import { TemplateModule } from 'src/template/template.module';

@Module({
  imports: [forwardRef(() => TemplateModule)],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseGateway],
  exports: [DatabaseService],
})
export class DatabaseModule {}
