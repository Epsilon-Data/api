import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ArchetypeStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
}

export class ArchetypeNodeDataDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsInt()
  @Min(0)
  level!: number;
}

export class ArchetypeNodePositionDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  x!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  y!: number;
}

export class ArchetypeNodeDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => ArchetypeNodeDataDto)
  data!: ArchetypeNodeDataDto;

  @ValidateNested()
  @Type(() => ArchetypeNodePositionDto)
  position!: ArchetypeNodePositionDto;
}

export class ArchetypeEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;
}

export class ArchetypeDto {
  @IsDefined()
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  archetypeId?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeNodeDto)
  nodes!: ArchetypeNodeDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeEdgeDto)
  edges!: ArchetypeEdgeDto[];

  @IsOptional()
  @IsEnum(ArchetypeStatus)
  status: ArchetypeStatus = ArchetypeStatus.Draft;

  @IsOptional()
  @Transform(
    ({ value }) => (typeof value === 'string' ? new Date(value) : value),
    { toClassOnly: true },
  )
  @IsDate()
  lastModified?: Date;
}
