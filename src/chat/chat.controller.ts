import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CommentDto } from './dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  createComment(@Body() dto: CommentDto) {
    return this.chatService.createComment(dto);
  }
}
