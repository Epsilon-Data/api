import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CommentDto } from './dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Connection Request')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create comment on request' })
  createComment(@Body() dto: CommentDto) {
    return this.chatService.createComment(dto);
  }
}
