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
import { DatabaseInfoDto } from 'src/connection_request/dto';

export class ProjectSummaryInfoDto {
  @ApiProperty({
    description: 'Unique project identifier (UUID)',
    format: 'uuid',
    example: '6d3cffa2-43b5-48a2-ba73-50931ddf07b2',
  })
  @IsDefined()
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    description: 'Custom human-readable project identifier',
    example: 'HRT-2025-001',
  })
  @IsString()
  customId!: string;

  @ApiProperty({
    description: 'Project name',
    example: 'Example Health Study',
  })
  @IsString()
  name!: string;

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
    description: 'Project lead researcher',
    example: 'Prof. Lead Researcher',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead: string;

  @ApiProperty({
    description: 'Current project lifecycle status',
    enum: $Enums.ProjectStatus,
    example: $Enums.ProjectStatus.READY,
  })
  @IsEnum($Enums.ProjectStatus)
  status!: $Enums.ProjectStatus;
}

export class ConnectionDto {
  @ApiProperty({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional({
    description:
      'Email of the organisation admin assigned to the project or owner',
    example: 'admin@university.edu',
  })
  @IsOptional()
  @IsString()
  orgAdminEmail?: string;

  @ApiPropertyOptional({
    description: 'Temporary database connection details',
    type: DatabaseInfoDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseInfoDto)
  tempDbDetails?: DatabaseInfoDto;

  @ApiPropertyOptional({
    description: 'Miscellaneous extra information provided by the user',
    example: 'Extra information and comments',
  })
  @IsOptional()
  @IsString()
  additionalInfo?: string;
}

export class ProjectDto {
  @ApiPropertyOptional({
    description: 'Unique project identifier (UUID)',
    format: 'uuid',
    example: '6d3cffa2-43b5-48a2-ba73-50931ddf07b2',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Current project lifecycle status',
    enum: $Enums.ProjectStatus,
    example: $Enums.ProjectStatus.READY,
  })
  @IsEnum($Enums.ProjectStatus)
  @IsOptional()
  status?: $Enums.ProjectStatus;

  @ApiPropertyOptional({
    description: 'Custom project identifier',
    example: 'customid123',
  })
  @IsOptional()
  @IsString()
  customId?: string;

  @ApiProperty({
    description: 'Owner user ID (UUID)',
    format: 'uuid',
    example: 'user_845aedf2-44aa-49c5-92e8-8c824f2ae123',
  })
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({
    description: 'Human-readable name of the project',
    example: 'Health Research Study',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Project lead researcher',
    example: 'Prof. Lead Researcher',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  lead!: string;

  @ApiProperty({
    description: 'Institution where the project is based',
    example: 'University of Edinburgh',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  university!: string;

  @ApiProperty({
    description: 'Faculty or department running the project',
    example: 'School of Informatics',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  faculty!: string;

  @ApiProperty({
    description: 'Ethics approval ID provided by the institution',
    example: 'ETH-2025-0912-A',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  ethicsId!: string;

  @ApiProperty({
    description: 'Full project description',
    example: 'Investigating correlations in large-scale MRI datasets...',
  })
  @IsDefined()
  @IsString()
  description!: string;

  @ApiProperty({
    description: 'Project start date',
    type: String,
    format: 'date-time',
    example: '2025-04-01T00:00:00.000Z',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  startDate!: Date;

  @ApiProperty({
    description: 'Project end date',
    type: String,
    format: 'date-time',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  endDate!: Date;

  // FIXME: This should be JSON or string[]
  @ApiPropertyOptional({
    description: 'List of members involved in the project',
    example: "[{'email': 'user1@email.com' 'role': 'collaborator'}]",
  })
  @IsOptional()
  @IsString()
  members?: string;

  @ApiProperty({
    description: 'Number of project participants',
    example: 148,
  })
  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInteger(value))
  participantsNum!: number;

  @ApiProperty({
    description: 'Keywords used to identify relevant database columns',
    isArray: true,
    example: ['heart_rate', 'age', 'bmi'],
  })
  @IsDefined()
  @IsString({ each: true })
  dbKeywords: string[];

  @ApiProperty({
    description: 'Connection metadata & crawling request info',
    type: ConnectionDto,
  })
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ConnectionDto)
  connection!: ConnectionDto;
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
