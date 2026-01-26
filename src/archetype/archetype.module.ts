import { forwardRef, Module } from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import { ArchetypeController } from './archetype.controller';
import { DatabaseModule } from 'src/database/database.module';
import { UploadModule } from 'src/upload/upload.module';
import { JobsModule } from 'src/jobs/jobs.module';
import { GraphModule } from 'src/graph/graph.module';
import { LlmModule } from 'src/llm/llm.module';

@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    UploadModule,
    JobsModule,
    GraphModule,
    LlmModule,
  ],
  controllers: [ArchetypeController],
  providers: [ArchetypeService],
  exports: [ArchetypeService],
})
export class ArchetypeModule {}
