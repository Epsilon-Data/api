import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CommentDto } from './dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async createComment(dto: CommentDto) {
    return this.prisma.comment.create({
      data: {
        requestId: dto.requestId,
        authorId: dto.authorId,
        content: dto.content,
      },
    });
  }
}
