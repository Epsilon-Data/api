import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums } from 'src/generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsDate,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { RequestDto } from 'src/connection-request/dto';
import { ProjectMember, UpdateProjectDto } from 'src/project/dto';

import { transformDateString } from 'src/utils/class.util';

export class AnalysisDto {
  @ApiPropertyOptional({
    description: 'Unique identifier of the request (if available)',
    format: 'uuid',
    example: 'dd28f0fe-a652-4061-8c3b-8ba00804e251',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiProperty({
    description: 'ID of the project',
    format: 'uuid',
    example: '8acb1887-6a73-4acd-be57-d0daa6d73be4',
  })
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;

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
    description: 'Position or job title of the requestor',
    example: 'Research Fellow',
  })
  @IsDefined()
  @IsString()
  requestorPosition!: string;

  @ApiProperty({
    description: 'Name of the project',
    example: 'Request Project Access Test',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectName!: string;

  @ApiProperty({
    description: 'Project start date',
    type: String,
    format: 'date-time',
    example: '2025-11-06T00:00:00.000Z',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  projectStartDate!: Date;

  @ApiProperty({
    description: 'Project end date',
    type: String,
    format: 'date-time',
    example: '2025-12-18T00:00:00.000Z',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  projectEndDate!: Date;

  @ApiProperty({
    description: 'Short description of the project',
    example: 'This is a test of project request.',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectDescription!: string;

  @ApiProperty({
    description: 'Main research objective of the project',
    example: 'Investigate cardiometabolic risk factors.',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectObjective!: string;

  @ApiProperty({
    description: 'Expected outcomes of the project',
    example: 'Generate preliminary insights for publication.',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectOutcome!: string;

  @ApiProperty({
    description: 'List of project members and their roles',
    type: () => ProjectMember,
    isArray: true,
    example: [
      {
        email: 'user1@example.org',
        role: 'collaborator',
      },
      {
        email: 'user2@example.org',
        role: 'data-manager',
      },
    ],
  })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMember)
  projectMembers!: ProjectMember[];

  @ApiProperty({
    description: 'Ethics ID or approval reference for the project',
    example: 'ETH-2024-1012',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  projectEthicsId!: string;
}

export class AnalysisRequestSummaryInfoDto {
  @ApiProperty({
    description: 'Unique identifier of the request',
    format: 'uuid',
    example: '7fa6ddfc-3d3d-4c1f-9de2-8dfd98f1b123',
  })
  @IsUUID()
  @IsNotEmpty()
  requestId!: string;

  @ApiProperty({
    description:
      'Unique identifier of the project associated with this request',
    format: 'uuid',
    example: '638c6f81-00c8-47f4-82ec-6b94240e757d',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({
    description: 'Human-readable name of the project',
    example: 'Health Project',
  })
  @IsString()
  @IsNotEmpty()
  projectName!: string;

  @ApiProperty({
    description: 'University or institution associated with the project',
    example: 'University of Edinburgh',
  })
  @IsString()
  @IsNotEmpty()
  projectUniversity!: string;

  @ApiProperty({
    description: 'Current status of the access request',
    enum: $Enums.RequestStatus,
    example: $Enums.RequestStatus.PENDING,
  })
  @IsEnum($Enums.RequestStatus)
  status!: $Enums.RequestStatus;

  @ApiProperty({
    description: 'Date and time when the request was created',
    type: String,
    format: 'date-time',
    example: '2025-11-20T10:15:30.000Z',
  })
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
  createdDate!: Date;

  @ApiProperty({
    description: 'Date and time when the request was last modified',
    type: String,
    format: 'date-time',
    example: '2025-11-20T11:42:10.000Z',
  })
  @IsDate()
  @IsDefined()
  @Transform(({ value }) => transformDateString(value))
  lastModified!: Date;
}

export class AnalysisRequestResponseDto {
  @ApiProperty({
    type: () => RequestDto,
    nullable: true,
    description: 'Request object',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RequestDto)
  request: RequestDto;

  @ApiProperty({
    description: 'Project name',
    example: 'Health Project',
  })
  @IsDefined()
  @IsString()
  projectName: string;
}

export class AnalysisRequestDetailsResponseDto extends AnalysisDto {
  @ApiProperty({ type: () => RequestDto, nullable: true })
  @ValidateNested()
  @Type(() => RequestDto)
  request?: RequestDto | null;

  @ApiProperty({ type: () => UpdateProjectDto, nullable: true })
  @ValidateNested()
  @Type(() => UpdateProjectDto)
  project?: UpdateProjectDto | null;
}

export class AnalysisStatusDto {
  @ApiProperty({
    description: 'Current status of the access request',
    enum: $Enums.RequestStatus,
    example: $Enums.RequestStatus.PENDING,
  })
  @IsDefined()
  @IsEnum($Enums.RequestStatus)
  status!: $Enums.RequestStatus;
}

export class AnalysisDecisionDto {
  @ApiProperty({
    description: 'Approval decision for the analysis request',
    example: true,
  })
  @IsDefined()
  @IsBoolean()
  isApproved!: boolean;
}
