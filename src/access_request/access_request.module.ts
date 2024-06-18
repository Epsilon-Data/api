import { Module } from '@nestjs/common';
import { AccessRequestService } from './access_request.service';
import { AccessRequestController } from './access_request.controller';

@Module({
  providers: [AccessRequestService],
  controllers: [AccessRequestController],
})
export class AccessRequestModule {}
