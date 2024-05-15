import { Module } from '@nestjs/common';
import { UserRequestService } from './user_request.service';
import { UserRequestController } from './user_request.controller';

@Module({
  providers: [UserRequestService],
  controllers: [UserRequestController],
})
export class UserRequestModule {}
