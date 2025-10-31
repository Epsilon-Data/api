// TODO: cleanup DTOs
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
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

export class UpdateArchetypeAttributesDto {
  @ApiPropertyOptional({
    description: 'Update display name of the archetype',
    example: 'Research 360 — Patient Health Update',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Update status of the archetype',
    enum: ArchetypeStatus,
    enumName: 'ArchetypeStatus',
    example: ArchetypeStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ArchetypeStatus)
  status?: ArchetypeStatus;
}

export class ArchetypeNodePermissionDto {
  @ApiProperty({
    description: 'Node identifier the permission applies to',
    example: 'node_1',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'Permission level for this node',
    enum: ArchetypePermission,
    enumName: 'ArchetypePermission',
    example: ArchetypePermission.DETAILED,
  })
  @IsDefined()
  @IsEnum(ArchetypePermission)
  permission!: ArchetypePermission;
}

export class ArchetypeNodeDataDto {
  @ApiProperty({
    description: 'Display label for the node',
    example: 'Participant',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({
    description: 'Depth level of the node within the archetype tree',
    example: 0,
    minimum: 0,
  })
  @IsDefined()
  @IsInt()
  @Min(0)
  level!: number;
}

export class ArchetypeNodePositionDto {
  @ApiProperty({
    description: 'X coordinate of the node in the tree layout',
    example: 120.5,
  })
  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  x!: number;

  @ApiProperty({
    description: 'Y coordinate of the node in the tree layout',
    example: 320.25,
  })
  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  y!: number;
}

@ApiExtraModels(ArchetypeNodeDataDto, ArchetypeNodePositionDto)
export class ArchetypeNodeDto {
  @ApiProperty({
    description: 'Unique node identifier',
    example: 'node_0',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'Node type',
    enum: ArchetypeNodeType,
    enumName: 'ArchetypeNodeType',
    example: ArchetypeNodeType.Root,
  })
  @IsDefined()
  @IsEnum(ArchetypeNodeType)
  type!: ArchetypeNodeType;

  @ApiProperty({
    description: 'Node metadata (label and hierarchy level)',
    type: () => ArchetypeNodeDataDto,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => ArchetypeNodeDataDto)
  data!: ArchetypeNodeDataDto;

  @ApiProperty({
    description: 'Node position in the tree layout',
    type: () => ArchetypeNodePositionDto,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => ArchetypeNodePositionDto)
  position!: ArchetypeNodePositionDto;
}

export class ArchetypeEdgeDto {
  @ApiProperty({
    description: 'Unique edge identifier',
    example: 'edge_node_0_node_1',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'Source node ID for this edge',
    example: 'node_0',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  source!: string;

  @ApiProperty({
    description: 'Target node ID for this edge',
    example: 'node_1',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  target!: string;
}

export class ArchetypeSummaryDto {
  @ApiPropertyOptional({
    description: 'Archetype identifier (system generated 12 char nanoid)',
    example: 'Xa7BAIWZCA8u',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Display name of the archetype',
    example: 'Research 360 — Patient Health',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Current status of the archetype',
    enum: ArchetypeStatus,
    enumName: 'ArchetypeStatus',
    example: ArchetypeStatus.ACTIVE,
  })
  @IsEnum(ArchetypeStatus)
  status!: ArchetypeStatus;

  @ApiProperty({
    description: 'Username or ID of the user who created this archetype',
    example: 'data-owner',
  })
  @IsString()
  @IsNotEmpty()
  createdBy!: string;

  @ApiProperty({
    description: 'Timestamp when the archetype was created (ISO 8601)',
    type: String,
    format: 'date-time',
    example: '2025-10-30T12:34:56.000Z',
  })
  @Type(() => Date)
  @IsDate()
  created!: Date;

  @ApiProperty({
    description: 'Timestamp when the archetype was last modified (ISO 8601)',
    type: String,
    format: 'date-time',
    example: '2025-10-31T08:15:42.000Z',
  })
  @Type(() => Date)
  @IsDate()
  lastModified!: Date;
}

export class ArchetypeDto {
  @ApiProperty({
    description: 'Project identifier',
    format: 'uuid',
    example: '638c6f81-00c8-47f4-82ec-6b94240e757d',
  })
  @IsDefined()
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Archetype identifier (system generated 12 char nanoid)',
    example: 'Xa7BAIWZCA8u',
  })
  @IsOptional()
  @IsString()
  archetypeId?: string;

  @ApiProperty({
    description: 'Display name of the archetype',
    minLength: 1,
    example: 'Research 360 — Patient Health',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Archetype nodes (tree vertices)',
    type: () => [ArchetypeNodeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeNodeDto)
  nodes?: ArchetypeNodeDto[];

  @ApiPropertyOptional({
    description: 'Archetype edges (tree connections between nodes)',
    type: () => [ArchetypeEdgeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeEdgeDto)
  edges?: ArchetypeEdgeDto[];

  @ApiPropertyOptional({
    description: 'Publishing status',
    enum: ArchetypeStatus,
    enumName: 'ArchetypeStatus',
    default: ArchetypeStatus.DRAFT,
    example: ArchetypeStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ArchetypeStatus)
  status: ArchetypeStatus = ArchetypeStatus.DRAFT;

  @ApiPropertyOptional({
    description: 'Per-node analysis permissions',
    type: () => [ArchetypeNodePermissionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeNodePermissionDto)
  permissions?: ArchetypeNodePermissionDto[];

  @ApiPropertyOptional({
    description: 'Last modified timestamp (ISO 8601)',
    type: String,
    format: 'date-time',
    example: '2025-10-03T09:42:15.123Z',
  })
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
