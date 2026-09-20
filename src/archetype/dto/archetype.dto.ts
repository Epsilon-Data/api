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
import { transformDateString } from 'src/utils/class.util';

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PUBLISHED'],
  PUBLISHED: ['ACTIVE', 'DRAFT'],
};

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
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
  created!: Date;

  @ApiProperty({
    description: 'Timestamp when the archetype was last modified (ISO 8601)',
    type: String,
    format: 'date-time',
    example: '2025-10-31T08:15:42.000Z',
  })
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
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
  @Transform(({ value }) => transformDateString(value), { toClassOnly: true })
  lastModified?: Date;

  @ApiProperty({
    description: 'User assigned database name',
    example: 'Health database',
  })
  @IsOptional()
  @IsString()
  dbName?: string;

  @ApiProperty({
    description: 'Database engine/ file type',
    example: 'postgres',
  })
  @IsOptional()
  @IsString()
  dbType?: string;
}

export class ArchetypeValidationIssueDto {
  @ApiProperty({
    description: 'Machine readable issue code',
    example: 'TABLES_NOT_CONNECTED',
  })
  code!: string;

  @ApiProperty({
    description: 'Errors block publishing, warnings do not',
    enum: ['error', 'warning'],
    example: 'error',
  })
  severity!: 'error' | 'warning';

  @ApiProperty({
    description: 'Human readable explanation',
    example: 'No foreign key path links hosp.labevents to hosp.patients',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'How to fix the issue',
    example:
      'Remove the fields from these tables, or add a FOREIGN KEY linking them to the rest and reconnect the data source.',
  })
  suggestion?: string;

  @ApiProperty({
    description: 'Archetype nodes the issue applies to',
    type: [String],
    example: ['node_4'],
  })
  nodeIds!: string[];

  @ApiPropertyOptional({
    description: 'Database tables the issue applies to',
    type: [String],
    example: ['hosp.labevents'],
  })
  tables?: string[];
}

@ApiExtraModels(ArchetypeValidationIssueDto)
export class ArchetypeValidationResultDto {
  @ApiProperty({
    description: 'True when the archetype has no errors and can be published',
    example: false,
  })
  valid!: boolean;

  @ApiProperty({ type: () => [ArchetypeValidationIssueDto] })
  issues!: ArchetypeValidationIssueDto[];

  @ApiProperty({
    description: 'Tables the archetype reads from',
    type: [String],
    example: ['hosp.admissions', 'hosp.diagnoses_icd', 'hosp.patients'],
  })
  tables!: string[];

  @ApiPropertyOptional({
    description:
      'Table whose row count drives the result set (one output row per row of this table)',
    example: 'hosp.diagnoses_icd',
  })
  rowDriver?: string;
}

@ApiExtraModels(ArchetypeNodeDto, ArchetypeEdgeDto, ArchetypeValidationIssueDto)
export class ArchetypeSuggestionDto {
  @ApiProperty({ example: 'sug_1f0c2a9e' })
  id!: string;

  @ApiProperty({ example: 'Diagnoses Icd with Admissions, Patients' })
  title!: string;

  @ApiProperty({
    example:
      'One row per hosp.diagnoses_icd record, enriched with hosp.admissions, hosp.patients through foreign keys.',
  })
  description!: string;

  @ApiProperty({
    description: 'Table whose row count drives the result set',
    example: 'hosp.diagnoses_icd',
  })
  rowDriver!: string;

  @ApiProperty({ type: [String] })
  tables!: string[];

  @ApiProperty({ example: 14 })
  columnCount!: number;

  @ApiProperty({
    description:
      'Columns left out: join keys, identifier-like columns and anything over the per-table cap',
    example: 5,
  })
  omittedColumnCount!: number;

  @ApiProperty({ type: () => [ArchetypeValidationIssueDto] })
  warnings!: ArchetypeValidationIssueDto[];

  @ApiProperty({
    description: 'Ready to load into the archetype editor',
    type: () => [ArchetypeNodeDto],
  })
  nodes!: ArchetypeNodeDto[];

  @ApiProperty({ type: () => [ArchetypeEdgeDto] })
  edges!: ArchetypeEdgeDto[];
}
