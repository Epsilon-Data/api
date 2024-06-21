import { Global, Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Global()
@Module({
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
