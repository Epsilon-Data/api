import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationDto } from './dto';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Notification')
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
  async getNotifications(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return this.notificationService.getNotifications(userId);
  }
}
