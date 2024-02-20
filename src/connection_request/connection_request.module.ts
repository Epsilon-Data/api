import { Module } from '@nestjs/common';
import { ConnectionRequestController } from './connection_request.controller';
import { ConnectionRequestService } from './connection_request.service';
import { UserService } from 'src/user/user.service';

@Module({
  controllers: [ConnectionRequestController],
  providers: [ConnectionRequestService, UserService],
})
export class ConnectionRequestModule {}
