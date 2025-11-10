import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationDto } from './dto';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private url;

  constructor(config: ConfigService) {
    this.url = config.get<string>('notificationServiceUrl');
  }

  async sendNotification(notificationDto: NotificationDto): Promise<unknown> {
    try {
      const response = await axios.post(`${this.url}/send`, notificationDto);
      return response.data;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: `Error sending notifications, error: ${error}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getNotifications(userId: string): Promise<unknown> {
    try {
      const response = await axios.get(`${this.url}/user/${userId}`);
      return response.data;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: `Error fetching notifications, error: ${error}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
