import { Module } from '@nestjs/common';
import { CoordinatorController } from './coordinator.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CoordinatorController],
})
export class CoordinatorModule {}
