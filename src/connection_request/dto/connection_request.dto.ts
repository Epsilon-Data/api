import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DatabaseInfoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
