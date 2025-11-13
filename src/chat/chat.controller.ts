import { Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CommentDto } from './dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create comment on request' })
  createComment(@Body() dto: CommentDto) {
    return this.chatService.createComment(dto);
  }
}
