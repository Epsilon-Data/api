import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class NotificationDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  senderId: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  type: number;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  senderType: string;

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  status: number;
}
