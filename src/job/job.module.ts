import { Global, Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';

@Global()
@Module({
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
