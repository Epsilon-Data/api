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
  archetype: string;

  @IsOptional()
  @IsString()
  columnMapping: string;

  @IsOptional()
  @IsString()
  archetypeId: string;
}
