import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { VaultModule } from 'src/vault/vault.module';
import { DatabaseModule } from 'src/database/database.module';
@Module({
  imports: [VaultModule, DatabaseModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
