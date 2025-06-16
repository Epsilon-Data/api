import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AdminModule } from 'src/admin/admin.module';
import { ProjectService } from 'src/project/project.service';

@Module({
  imports: [AdminModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, ProjectService],
})
export class AnalysisModule {}
