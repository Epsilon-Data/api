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
} from 'class-validator';

export enum AtlasQueryType {
  BASIC = 'BASIC',
  DSL = 'DSL',
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
}

export class AtlasRelationshipMetaDto {
  @IsString()
  typeName!: string;
}

export class AtlasRelatedEntityRefDto {
  @IsUUID()
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

  @ValidateNested()
  @Type(() => AtlasRelationshipMetaDto)
  relationshipAttributes!: AtlasRelationshipMetaDto;

  @IsString()
  qualifiedName!: string;
}

export class AtlasRelationshipAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AtlasRelatedEntityRefDto)
  nodes!: AtlasRelatedEntityRefDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelatedEntityRefDto)
  instance?: AtlasRelatedEntityRefDto;

  // Glossary meanings; sample shows an empty array. Keep generic unless you know the structure.
  @IsArray()
  meanings!: unknown[];
}

export class AtlasEntityDto {
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
  attributes?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => AtlasRelationshipAttributesDto)
  relationshipAttributes?: AtlasRelationshipAttributesDto;
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

export class AtlasSearchDslAttributesBlockDto {
  @IsArray()
  @IsString({ each: true })
  name!: string[];

  @IsArray()
  values!: string[][];
}

export class AtlasSearchDslAttributesResponseDto {
  @ValidateNested()
  @Type(() => AtlasSearchDslAttributesBlockDto)
  attributes!: AtlasSearchDslAttributesBlockDto;

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
