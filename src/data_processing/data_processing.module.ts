import { Global, Module } from '@nestjs/common';
import { DataProcessingService } from './data_processing.service';

@Global()
@Module({
  providers: [DataProcessingService],
  exports: [DataProcessingService],
})
export class DataProcessingModule {}
