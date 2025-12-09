import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AdminModule } from 'src/admin/admin.module';
import { ArchetypeModule } from 'src/archetype/archetype.module';
import { AnalysisRequestModule } from 'src/analysis-request/analysis-request.module';

@Module({
  imports: [AdminModule, ArchetypeModule, AnalysisRequestModule],
  controllers: [AnalysisController],
})
export class AnalysisModule {}
