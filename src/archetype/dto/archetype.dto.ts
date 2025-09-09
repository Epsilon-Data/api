import {
  IsDefined,
  IsJSON,
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
  @IsJSON()
  archetype: string;

  @IsOptional()
  @IsString()
  @IsJSON()
  columnMapping: string;

  @IsOptional()
  @IsString()
  archetypeId: string;
}
