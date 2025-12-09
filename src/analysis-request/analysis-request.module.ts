import { Module } from '@nestjs/common';
import { AnalysisRequestService } from './analysis-request.service';
import { AnalysisRequestController } from './analysis-request.controller';

@Module({
  providers: [AnalysisRequestService],
  controllers: [AnalysisRequestController],
  exports: [AnalysisRequestService],
})
export class AnalysisRequestModule {}
