import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRequestService } from './user_request.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { RevisionDto } from './dto/user_request.dto';

@Controller('user-request')
export class UserRequestController {
  constructor(private userRequestService: UserRequestService) {}

  @Get('details')
  details(@Query('requestId', ParseUUIDPipe) requestId: string) {
    return this.userRequestService.details(requestId);
  }

  @Get('summary')
  @UseGuards(new AuthGuard('api.hub.read'))
  summary(@Req() request) {
    return this.userRequestService.summary(request);
  }

  @Patch('revision')
  revision(@Body() dto: RevisionDto) {
    return this.userRequestService.revision(dto);
  }
}
