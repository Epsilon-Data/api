import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SettingsDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  cover?: Buffer;

  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => TableauDto)
  tableau?: TableauDto[];
}

class TableauDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

export class OverallSummaryDto {
  @ApiProperty({
    description: 'Number of schemas in the project',
    example: 5,
  })
  @IsDefined()
  @IsNumber()
  schemaCount!: number;

  @ApiProperty({
    description: 'Total number of tables across all schemas',
    example: 42,
  })
  @IsDefined()
  @IsNumber()
  totalTableCount!: number;

  @ApiProperty({
    description: 'Total number of columns across all tables',
    example: 128,
  })
  @IsDefined()
  @IsNumber()
  totalColCount!: number;
}

export class DatabaseSummaryResponseDto {
  @ApiProperty({
    description: 'Aggregate database statistics summary',
    type: () => OverallSummaryDto,
  })
  @ValidateNested()
  @Type(() => OverallSummaryDto)
  overall!: OverallSummaryDto;

  @ApiProperty({
    description: 'Serialized diagram string',
    example: 'diagram-json',
  })
  @IsDefined()
  @IsString()
  diagram!: string;
}

export class ColumnInfoDto {
  @ApiProperty({
    description: 'Column name',
    example: 'patient_id',
  })
  @IsDefined()
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Data type of the column',
    example: 'integer',
  })
  @IsDefined()
  @IsString()
  type!: string;

  @ApiProperty({
    description: 'Whether the column is nullable',
    example: false,
  })
  @IsDefined()
  @IsBoolean()
  nullable!: boolean;

  @ApiProperty({
    description: 'Whether the column is part of the primary key',
    example: true,
  })
  @IsDefined()
  @IsBoolean()
  primary!: boolean;
}

export class DatabaseTableDto {
  @ApiProperty({
    description: 'Table name',
    example: 'patients',
  })
  @IsDefined()
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Total number of columns in the table',
    example: 12,
  })
  @IsDefined()
  @IsNumber()
  colCount!: number;

  @ApiProperty({
    description: 'Schema the table belongs to',
    example: 'public',
  })
  @IsDefined()
  @IsString()
  schema!: string;

  @ApiProperty({
    description: 'List of column definitions in this table',
    type: () => ColumnInfoDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnInfoDto)
  columns!: ColumnInfoDto[];
}

export class TableColumnRefDto {
  @ApiProperty({
    description: 'Atlas column GUID',
    example: 'c1a2b3c4-1234-5678-9abc-def012345678',
  })
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: 'Column name',
    example: 'patient_id',
  })
  @IsDefined()
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Owning table name',
    example: 'patients',
  })
  @IsDefined()
  @IsString()
  table!: string;
}
