import { IsDefined, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CommentDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  requestId: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  authorId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  content: string;
}
