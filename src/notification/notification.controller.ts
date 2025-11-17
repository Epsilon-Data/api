import { Body, Controller, Get, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationDto } from './dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { CurrentUserInfo } from 'src/common/decorators/user.decorator';

@ApiTags('Notification')
@ApiBearerAuth()
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Send notification' })
  async sendNotification(@Body() dto: NotificationDto) {
    return this.notificationService.sendNotification(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  async getNotifications(@CurrentUser() user: CurrentUserInfo) {
    return this.notificationService.getNotifications(user.id);
  }
}
