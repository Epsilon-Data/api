import { forwardRef, Module } from '@nestjs/common';
import { ArchetypeService } from './archetype.service';
import { ArchetypeController } from './archetype.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [forwardRef(() => DatabaseModule)],
  controllers: [ArchetypeController],
  providers: [ArchetypeService],
  exports: [ArchetypeService],
})
export class ArchetypeModule {}
