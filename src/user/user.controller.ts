import { Controller, Get, Req } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
  @Get('admin')
  delete(@Req() request) {
    return this.userService.admin(request);
  }
}
