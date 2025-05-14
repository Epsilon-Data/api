import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ArchetypeDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsString()
  template: string;

  @IsOptional()
  @IsString()
  columnMapping: string;

  @IsOptional()
  @IsString()
  templateId: string;
}
