import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { VaultModule } from 'src/vault/vault.module';
@Module({
  imports: [VaultModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
