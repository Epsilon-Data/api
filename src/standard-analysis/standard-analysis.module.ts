import { Module } from '@nestjs/common';
import { StandardAnalysisService } from './standard-analysis.service';

@Module({
  providers: [StandardAnalysisService],
  exports: [StandardAnalysisService],
})
export class StandardAnalysisModule {}
