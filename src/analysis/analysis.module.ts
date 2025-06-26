import { forwardRef, Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { AdminModule } from 'src/admin/admin.module';
import { ProjectService } from 'src/project/project.service';
import { ArchetypeService } from 'src/archetype/archetype.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [AdminModule, forwardRef(() => DatabaseModule)],
  controllers: [AnalysisController],
  providers: [AnalysisService, ProjectService, ArchetypeService],
})
export class AnalysisModule {}
