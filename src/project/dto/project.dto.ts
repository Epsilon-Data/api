import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDate,
  IsOptional,
  IsNumber,
  IsNotEmptyObject,
  IsObject,
  ValidateNested,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { parseInteger, transformDateString } from 'src/utils/class.util';

import { $Enums } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectListDto {
  @ApiProperty({
    description: 'Unique project identifier (UUID or slug)',
    example: 'proj_123abc456',
  })
  @IsString()
  projectId!: string;

  @ApiProperty({
    description: 'Custom human-readable project identifier',
    example: 'HRT-2025-001',
  })
  @IsString()
  customId!: string;

  @ApiProperty({
    description: 'Project name',
    example: 'Heart Rate Variability Study',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'University associated with this project',
    example: 'University of Oxford',
  })
  @IsString()
  university!: string;

  @ApiProperty({
    description: 'Faculty or department within the university',
    example: 'Department of Biomedical Engineering',
  })
  @IsString()
  faculty!: string;

  @ApiProperty({
    description: 'Timestamp of last modification',
    example: '2025-11-12T09:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  lastModified!: Date;

  @ApiProperty({
    description: 'Timestamp when the project was created',
    example: '2025-10-01T14:45:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  createdDate!: Date;

  @ApiProperty({
    description: 'Current project lifecycle status',
    enum: $Enums.ProjectStatus,
    example: $Enums.ProjectStatus.READY,
  })
  @IsEnum($Enums.ProjectStatus)
  status!: $Enums.ProjectStatus;
}

export class DatabaseDto {
  @ApiProperty({
    description: 'Human-readable database name',
    example: 'Research DB',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Type of the datasource (e.g. database engine or file type)',
    example: 'postgres',
  })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({
    description: 'Connection URL to access the database',
    example: 'pg://user:pass@localhost:5432/mydb',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'Database username',
    example: 'db_user',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Database password',
    example: '**********',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

export class ConnectionDto {
  @ApiProperty({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsOptional()
  @IsUUID()
  requestId: string;

  @ApiPropertyOptional({
    description: 'Email of the organisation admin assigned to the project',
    example: 'admin@university.edu',
  })
  @IsOptional()
  @IsString()
  orgAdminEmail?: string;

  @ApiPropertyOptional({
    description: 'Temporary database connection details',
    type: DatabaseDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseDto)
  tempDbDetails?: DatabaseDto;

  @ApiPropertyOptional({
    description: 'Miscellaneous extra information provided by the user',
    example: 'DB accessible only after VPN activation',
  })
  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class ProjectDto {
  @IsOptional()
  @IsUUID()
  projectId: string;

  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  @IsOptional()
  @IsString()
  customId?: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  university: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  faculty: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  ethicsId: string;

  @IsDefined()
  @IsString()
  description: string;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  startDate: Date;

  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  endDate: Date;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  members: string;

  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInteger(value))
  participantsNum: number;

  @IsDefined()
  @IsString({ each: true })
  dbKeywords: string[];

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ConnectionDto)
  connection: ConnectionDto;
}

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
  @Type(() => VisualDto)
  visualizations?: VisualDto[];
}

class VisualDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDefined()
  @IsUrl()
  @IsNotEmpty()
  link: string;
}
