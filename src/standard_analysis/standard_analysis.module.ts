import { Global, Module } from '@nestjs/common';
import { StandardAnalysisService } from './standard_analysis.service';

@Global()
@Module({
  providers: [StandardAnalysisService],
  exports: [StandardAnalysisService],
})
export class StandardAnalysisModule {}
