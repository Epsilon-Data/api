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
  IsJSON,
  IsArray,
  IsEmail,
} from 'class-validator';
import { parseInteger, transformDateString } from 'src/utils/class.util';

import { $Enums, Prisma } from 'src/generated/prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ConnectionDto,
  ConnectionRequestDto,
  ConnectionRequestResponseDto,
} from 'src/connection-request/dto';
import { AnalysisRequestResponseDto } from 'src/analysis-request/dto';

export class ProjectMember {
  @ApiPropertyOptional({
    description: 'Email address of the project member',
    example: 'user@example.org',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Role of the member within the project',
    example: 'collaborator',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Full name of the member',
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

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
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
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
export class CreateProjectDto {
  @ApiPropertyOptional({
    description: 'Custom project identifier',
    example: 'customid123',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  customId?: string;

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
  @IsNotEmpty()
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

  @ApiPropertyOptional({
    description: 'List of members and roles involved in the project',
    example: "[{'email': 'user1@email.com', 'role': 'collaborator'}]",
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMember)
  members!: ProjectMember[];

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
  dbKeywords!: string[];

  @ApiProperty({
    description: 'Connection metadata & crawling request info',
    type: ConnectionDto,
  })
  @IsDefined()
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ConnectionDto)
  connection!: ConnectionDto;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiProperty({
    description: 'Unique project identifier (UUID)',
    format: 'uuid',
    example: '6d3cffa2-43b5-48a2-ba73-50931ddf07b2',
  })
  @IsDefined()
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Current project lifecycle status',
    enum: $Enums.ProjectStatus,
    example: $Enums.ProjectStatus.PENDING,
  })
  @IsEnum($Enums.ProjectStatus)
  @IsOptional()
  status?: $Enums.ProjectStatus;
}

export class SettingsDto {
  @ApiProperty({
    description: 'Unique project identifier (UUID)',
    format: 'uuid',
    example: '6d3cffa2-43b5-48a2-ba73-50931ddf07b2',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Cover image file stored as binary data (Buffer)',
    type: 'string',
    format: 'binary',
    nullable: true,
    example: null,
  })
  @IsOptional()
  cover?: Buffer;

  @ApiPropertyOptional({
    description: 'Array of visuals containing title + external link',
    type: () => [VisualDto],
    nullable: true,
    example: [
      {
        title: 'Health conditions',
        link: 'https://app.example.com/visuals/health-overview',
      },
      {
        title: 'Demographics Breakdown',
        link: 'https://app.example.com/demographics/breakdown',
      },
    ],
  })
  @IsOptional()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => VisualDto)
  visualizations?: VisualDto[];
}
export class VisualDto {
  @ApiProperty({
    description: 'Title describing the visualization or external resource',
    example: 'Patients demographics breakdown',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'External link pointing to the visualization resource',
    format: 'uri',
    example: 'https://app.example.com/demographics/breakdown',
  })
  @IsDefined()
  @IsUrl()
  @IsNotEmpty()
  link!: string;
}

export class SettingsResponseDto {
  @ApiProperty({
    description: 'Unique project identifier (UUID)',
    format: 'uuid',
    example: '6d3cffa2-43b5-48a2-ba73-50931ddf07b2',
  })
  @IsDefined()
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    description: 'Unique project identifier (UUID)',
    format: 'uri',
    example: 'https://image.com/6d3cffa2-43b5-48a2-ba73-50931ddf07b2/cover.jpg',
  })
  @IsOptional()
  @IsUrl()
  cover?: string;

  @ApiProperty({
    description: 'List of visualisations for the project',
    type: Object,
    nullable: true,
  })
  @IsDefined()
  @IsJSON()
  visualizations: Prisma.JsonValue | null;
}

export class ProjectDetailsResponseDto {
  @ApiPropertyOptional({
    type: () => ConnectionRequestDto,
    nullable: true,
    description: 'Request object, null if no request exists',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConnectionRequestDto)
  connection?: ConnectionRequestDto | null;

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

  @ApiProperty({
    description: 'Number of project participants',
    example: 148,
  })
  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInteger(value))
  participantsNum!: number;

  @ApiPropertyOptional({
    description: 'Keywords used to identify relevant database columns',
    isArray: true,
    example: ['heart_rate', 'age', 'bmi'],
  })
  @IsDefined()
  @IsString({ each: true })
  dbKeywords: string[];

  @ApiPropertyOptional({
    description: 'List of team member names',
    type: Object,
    nullable: true,
    example: ['John Smith', 'Jane Doe'],
  })
  @IsOptional()
  @IsJSON()
  members: Prisma.JsonValue | null;
}

export class ProjectRequestsResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the request',
    format: 'uuid',
    example: 'dd28f0fe-a652-4061-8c3b-8ba00804e251',
  })
  @IsDefined()
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    description: 'Name of the project',
    example: 'Request Project Access Test',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectName!: string;

  @ApiProperty({
    enum: $Enums.RequestStatus,
    description: 'The status of the request',
    example: $Enums.RequestStatus.PENDING,
  })
  @IsEnum($Enums.RequestStatus)
  status: $Enums.RequestStatus;

  @ApiProperty({
    description: 'Name of the person requesting access',
    example: 'Data Owner User',
  })
  @IsDefined()
  @IsString()
  requestorName!: string;

  @ApiProperty({
    description: 'Email address of the requestor',
    example: 'owner@example.org',
  })
  @IsDefined()
  @IsString()
  requestorEmail!: string;

  @ApiProperty({
    description: 'Organization of the requestor',
    example: 'University of Edinburgh',
  })
  @IsDefined()
  @IsString()
  requestorOrgName!: string;

  @ApiProperty({
    type: Date,
    description: 'The date the request was created',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  createdDate!: Date;
}

export class ProjectRequestsResponse {
  @ApiProperty({
    description: 'Connection requests for the project',
    type: () => [ConnectionRequestResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConnectionRequestResponseDto)
  connection!: ProjectRequestsResponseDto[];

  @ApiProperty({
    description: 'Analysis requests for the project',
    type: () => [AnalysisRequestResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnalysisRequestResponseDto)
  analysis: ProjectRequestsResponseDto[];
}
