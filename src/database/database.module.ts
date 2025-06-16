import { forwardRef, Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { DatabaseGateway } from './database.gateway';
import { ArchetypeModule } from 'src/archetype/archetype.module';

@Module({
  imports: [forwardRef(() => ArchetypeModule)],
  controllers: [DatabaseController],
  providers: [DatabaseService, DatabaseGateway],
  exports: [DatabaseService],
})
export class DatabaseModule {}
