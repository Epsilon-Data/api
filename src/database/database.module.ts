import { forwardRef, Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { ArchetypeModule } from 'src/archetype/archetype.module';

@Module({
  imports: [forwardRef(() => ArchetypeModule)],
  controllers: [DatabaseController],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
