import { IsDefined, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DatabaseInfoDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
