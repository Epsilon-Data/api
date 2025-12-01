import { forwardRef, Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AdminModule } from 'src/admin/admin.module';
import { ArchetypeService } from 'src/archetype/archetype.service';
import { DatabaseModule } from 'src/database/database.module';
import { AnalysisRequestService } from 'src/analysis-request/analysis-request.service';

@Module({
  imports: [AdminModule, forwardRef(() => DatabaseModule)],
  controllers: [AnalysisController],
  providers: [AnalysisService, ArchetypeService, AnalysisRequestService],
})
export class AnalysisModule {}
