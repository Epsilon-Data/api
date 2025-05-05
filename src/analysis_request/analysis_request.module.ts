import { Module } from '@nestjs/common';
import { AnalysisRequestService } from './analysis_request.service';
import { AnalysisRequestController } from './analysis_request.controller';

@Module({
  providers: [AnalysisRequestService],
  controllers: [AnalysisRequestController],
})
export class AnalysisRequestModule {}
