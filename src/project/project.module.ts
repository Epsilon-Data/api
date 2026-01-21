import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { VaultModule } from 'src/vault/vault.module';
import { ConnectionFlowService } from 'src/common/services/connection-flow.service';

@Module({
  imports: [VaultModule],
  controllers: [ProjectController],
  providers: [ProjectService, ConnectionFlowService],
})
export class ProjectModule {}
