// TODO: cleanup DTOs
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
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PUBLISHED = 'PUBLISHED',
}

export enum ArchetypeNodeType {
  Root = 'root',
  Category = 'category',
  Column = 'column',
}

export enum ArchetypePermission {
  NONE = 'NONE',
  HIGH_LEVEL = 'HIGH_LEVEL',
  DETAILED = 'DETAILED',
}

export class ArchetypeNodePermissionDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsDefined()
  @IsEnum(ArchetypePermission)
  permission!: ArchetypePermission;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeNodeDto)
  nodes?: ArchetypeNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeEdgeDto)
  edges?: ArchetypeEdgeDto[];

  @IsOptional()
  @IsEnum(ArchetypeStatus)
  status: ArchetypeStatus = ArchetypeStatus.DRAFT;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeNodePermissionDto)
  permissions?: ArchetypeNodePermissionDto[];

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => transformToDateString(value), { toClassOnly: true })
  lastModified?: Date;
}

function transformToDateString(value: any): Date {
  if (value == null || value === '') return undefined;

  if (typeof value === 'string') {
    const timestamp = Number(value);
    // handle numeric string =
    if (!isNaN(timestamp)) return new Date(timestamp);
    return new Date(value);
  }
  // handle epoch as number
  if (typeof value === 'number') {
    return new Date(value);
  }
  // already a Date or invalid input
  return value;
}
