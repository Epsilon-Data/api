import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class RequestCommentDto {
  @ApiProperty({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    description: 'Comment identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsUUID()
  @IsOptional()
  commentId?: string;

  @ApiProperty({
    description: 'Author identifier (userId)',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e2230',
  })
  @IsUUID()
  authorId!: string;

  @ApiProperty({
    description: 'Name of the author of the comment',
    example: 'Owner User',
  })
  @IsDefined()
  @IsString()
  authorName!: string;

  @ApiProperty({
    type: Date,
    description: 'The date the comment was created',
  })
  @IsDate()
  @Type(() => Date)
  createdDate: Date;

  @ApiProperty({
    description: 'Comment content',
    example: 'This is a comment.',
  })
  @IsString()
  content!: string;
}
