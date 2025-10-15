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

export enum ArchetypeNodeType {
  Root = 'root',
  Category = 'category',
  Column = 'column',
}

export class ArchetypeNodeDataDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  level!: number;
}

export class ArchetypeNodePositionDto {
  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  x!: number;

  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  y!: number;
}

export class ArchetypeNodeDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsDefined()
  @IsEnum(ArchetypeNodeType)
  type!: ArchetypeNodeType;

  @IsDefined()
  @ValidateNested()
  @Type(() => ArchetypeNodeDataDto)
  data!: ArchetypeNodeDataDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => ArchetypeNodePositionDto)
  position!: ArchetypeNodePositionDto;
}

export class ArchetypeEdgeDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
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
