import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { JobsModule } from '../jobs/jobs.module';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [JobsModule, GraphModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
