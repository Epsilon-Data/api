// TODO: cleanup DTOs
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  IsInt,
  IsUUID,
  IsNotEmpty,
  IsDefined,
  Equals,
} from 'class-validator';
import {
  ArchetypeNodePositionDto,
  ArchetypePermission,
} from 'src/archetype/dto';

export enum AtlasQueryType {
  BASIC = 'BASIC',
  DSL = 'DSL',
}

export enum AtlasArchetypeNodeTypeName {
  Root = 'root_node',
  Branch = 'branch_node',
  Leaf = 'leaf_node',
}
export enum AtlasArchetypeTypeName {
  Template = 'archetype_template',
  Node = 'archetype_node',
}

export class AtlasArchetypeNodeAttributesDto {
  @IsString()
  owner: string;

  @IsString()
  replicatedTo: string | null;

  @IsString()
  userDescription: string | null;

  @IsString()
  replicatedFrom: string | null;

  @IsString()
  qualifiedName: string;

  @IsString()
  displayName: string | null;

  @IsString()
  name: string;

  @IsString()
  description: string | null;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArchetypeNodePositionDto)
  position?: ArchetypeNodePositionDto;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AtlasSimpleClassificationDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  typeName!: string;

  @IsOptional()
  @IsBoolean()
  propagate?: boolean = true;

  @IsBoolean()
  @IsOptional()
  removePropagationsOnEntityDelete?: boolean = false;
}

export class AtlasArchetypeAnalysisPermissionClassificationDto extends AtlasSimpleClassificationDto {
  @Equals('archetype_node_analysis_permissions')
  override typeName = 'archetype_node_analysis_permissions' as const;

  @IsDefined()
  @IsObject()
  attributes!: {
    access_level: ArchetypePermission;
  };
}

export class AtlasClassificationDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  typeName!: string;

  @IsOptional()
  @IsBoolean()
  propagate?: boolean = true;

  @IsBoolean()
  @IsOptional()
  removePropagationsOnEntityDelete?: boolean = false;
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class AtlasMutatedEntitiesDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityDto)
  CREATE?: AtlasEntityDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityDto)
  UPDATE?: AtlasEntityDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityDto)
  DELETE?: AtlasEntityDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityDto)
  PARTIAL_UPDATE?: AtlasEntityDto[];
}

export class AtlasEntityHeaderDto {
  @IsString()
  guid!: string;

  @IsString()
  typeName!: string;

  @IsOptional()
  @IsString()
  displayText?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsString()
  status!: string; // Atlas built in entity status

  @IsArray()
  classificationNames!: unknown[];

  @IsArray()
  classifications: unknown[];

  @IsArray()
  meaningNames!: unknown[];

  @IsArray()
  meanings!: unknown[];

  @IsBoolean()
  isIncomplete!: boolean;

  @IsArray()
  labels!: unknown[];
}

export class AtlasRelationshipMetaDto {
  @IsString()
  typeName!: string;
}

export class AtlasRelatedEntityRefDto {
  @IsString()
  guid!: string;

  @IsString()
  typeName!: string;

  @IsString()
  entityStatus!: string;

  @IsString()
  displayText!: string;

  @IsString()
  relationshipType!: string;

  @IsUUID()
  relationshipGuid!: string;

  @IsString()
  relationshipStatus!: string;

  @IsOptional()
  @IsObject()
  relationshipAttributes!: Record<string, unknown>;

  @IsString()
  qualifiedName!: string;
}

export class AtlasArchetypeRelationshipMetaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasRelatedEntityRefDto)
  nodes!: AtlasRelatedEntityRefDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  template?: AtlasRelatedEntityRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  instance?: AtlasRelatedEntityRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  parent_node?: AtlasRelatedEntityRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  column?: AtlasRelatedEntityRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  child_nodes?: AtlasRelatedEntityRefDto[];

  // Glossary meanings
  @IsArray()
  meanings!: unknown[];
}

export class AtlasEntityDto<
  Attributes = Record<string, unknown>,
  RelationshipAttributes = Record<string, unknown>,
> {
  @IsUUID()
  guid!: string;

  @IsBoolean()
  isIncomplete!: boolean;

  @IsString()
  typeName!: string;

  @IsOptional()
  @IsString()
  displayText?: string;

  @IsString()
  status!: string; // Atlas built in entity status

  @IsString()
  createdBy!: string;

  @IsString()
  updatedBy!: string;

  @IsInt()
  createTime!: number; // epoch millis

  @IsInt()
  updateTime!: number; // epoch millis

  @IsInt()
  version!: number;

  @IsArray()
  @IsString({ each: true })
  labels!: string[];

  @IsOptional()
  @IsObject()
  attributes?: Attributes;

  @IsOptional()
  @IsObject()
  relationshipAttributes?: RelationshipAttributes;
}

export class AtlasSubmitArchetypeEntityDto {
  @IsOptional()
  @IsString()
  guid?: string;

  @IsString()
  typeName!: string;

  @IsOptional()
  @IsString()
  status?: string = 'ACTIVE';

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  relationshipAttributes?: Record<string, unknown>;
}

export class AtlasArchetypeEntityClassificationDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  typeName!: string;

  @IsString()
  entityStatus?: string;

  @IsString()
  entityGuid?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class AtlasArchetypeEntityDto extends AtlasEntityDto<
  AtlasArchetypeNodeAttributesDto,
  AtlasArchetypeRelationshipMetaDto
> {
  @IsEnum(AtlasArchetypeTypeName)
  declare typeName: AtlasArchetypeTypeName;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasArchetypeNodeAttributesDto)
  declare attributes: AtlasArchetypeNodeAttributesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasArchetypeRelationshipMetaDto)
  declare relationshipAttributes?: AtlasArchetypeRelationshipMetaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasArchetypeEntityClassificationDto)
  classifications?: AtlasArchetypeEntityClassificationDto[];
}

export class AtlasSearchBasicResponseDto {
  @IsEnum(AtlasQueryType)
  queryType!: AtlasQueryType.BASIC;

  @IsObject()
  searchParameters!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityHeaderDto)
  entities?: AtlasEntityHeaderDto[];

  @IsNumber()
  approximateCount!: number;
}

export class AtlasSearchDslResponseDto {
  @IsEnum(AtlasQueryType)
  queryType!: AtlasQueryType.DSL;

  @IsString()
  queryText!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityHeaderDto)
  entities?: AtlasEntityHeaderDto[];

  @IsNumber()
  approximateCount!: number;
}

export class AtlasSearchAttributesBlockDto {
  @IsArray()
  @IsString({ each: true })
  name!: string[];

  @IsArray()
  values!: string[][];
}

export class AtlasSearchBasicHeadlessResponseDto {
  @IsEnum(AtlasQueryType)
  queryType!: AtlasQueryType.BASIC;

  @IsObject()
  searchParameters!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => AtlasSearchAttributesBlockDto)
  attributes!: AtlasSearchAttributesBlockDto;

  @IsNumber()
  approximateCount!: number;
}

export class AtlasSearchDslAttributesResponseDto {
  @ValidateNested()
  @Type(() => AtlasSearchAttributesBlockDto)
  attributes!: AtlasSearchAttributesBlockDto;

  @IsNumber()
  approximateCount!: number;
}

export class AtlasEntityResponseDto {
  @IsObject()
  referredEntities!: Record<string, AtlasEntityDto>;

  @ValidateNested()
  @Type(() => AtlasEntityDto)
  entity!: AtlasEntityDto;
}

export class AtlasBulkEntityResponseDto {
  @IsObject()
  referredEntities!: Record<string, AtlasEntityDto>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasEntityDto)
  entities!: AtlasEntityDto[];
}

export class AtlasArchetypeEntityResponseDto {
  @IsObject()
  referredEntities!: Record<string, AtlasArchetypeEntityDto>;

  @ValidateNested()
  @Type(() => AtlasArchetypeEntityDto)
  entity!: AtlasArchetypeEntityDto;
}

export class AtlasPostEntityResponseDto {
  @ValidateNested()
  @Type(() => AtlasMutatedEntitiesDto)
  mutatedEntities: AtlasMutatedEntitiesDto;

  @IsOptional()
  @IsObject()
  guidAssignments?: Record<string, string>;
}

export class AtlasPutEntityResponseDto extends AtlasPostEntityResponseDto {
  @IsDefined()
  @IsArray()
  partialUpdatedEntities?: unknown[];
}

export class AtlasExistingNode {
  @IsDefined()
  @IsUUID()
  guid: string;

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasArchetypeEntityDto)
  classifications: AtlasArchetypeEntityDto['classifications'];
}
