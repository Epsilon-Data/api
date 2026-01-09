import { Module } from '@nestjs/common';
import { CoordinatorController } from './coordinator.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AnalysisRequestModule } from 'src/analysis-request/analysis-request.module';

@Module({
  imports: [DatabaseModule, AnalysisRequestModule],
  controllers: [CoordinatorController],
})
export class CoordinatorModule {}
