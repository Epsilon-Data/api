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

export class AtlasEntityDto {
  @IsString()
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
  @IsObject()
  relationshipAttributes?: Record<string, unknown>;
}

export class AtlasSearchAttributeResponseDto {
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
