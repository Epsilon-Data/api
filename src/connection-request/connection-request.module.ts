import { Module } from '@nestjs/common';
import { ConnectionRequestController } from './connection-request.controller';
import { ConnectionRequestService } from './connection-request.service';
import { VaultModule } from 'src/vault/vault.module';
import { ConnectionFlowService } from 'src/common/services/connection-flow.service';

@Module({
  imports: [VaultModule],
  controllers: [ConnectionRequestController],
  providers: [ConnectionRequestService, ConnectionFlowService],
})
export class ConnectionRequestModule {}
