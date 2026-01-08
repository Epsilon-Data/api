import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsDate,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { transformDateString } from 'src/utils/class.util';

export class RequestCommentDto {
  @ApiProperty({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsUUID()
  @IsDefined()
  requestId!: string;

  @ApiPropertyOptional({
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
  @IsDefined()
  authorId!: string;

  @ApiProperty({
    description: 'Name of the author of the comment',
    example: 'Owner User',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  authorName!: string;

  @ApiProperty({
    type: Date,
    description: 'The date the comment was created',
  })
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
  createdDate!: Date;

  @ApiProperty({
    description: 'Comment content',
    example: 'This is a comment.',
  })
  @IsString()
  @IsDefined()
  @IsNotEmpty()
  content!: string;
}

export class GetRequestCommentsDto {
  @ApiProperty({
    description:
      'Indicates whether the requester (true) or receiver (false) is making the request',
    example: true,
  })
  @IsBooleanString()
  @IsDefined()
  isRequestor!: 'true' | 'false';
}
