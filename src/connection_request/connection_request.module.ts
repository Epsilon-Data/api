import { Module } from '@nestjs/common';
import { ConnectionRequestController } from './connection_request.controller';
import { ConnectionRequestService } from './connection_request.service';

@Module({
  controllers: [ConnectionRequestController],
  providers: [ConnectionRequestService],
})
export class ConnectionRequestModule {}
