import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums, Prisma } from 'src/generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDefined,
  IsEnum,
  IsJSON,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RequestCommentDto } from 'src/common/dto';
import { transformDateString } from 'src/utils/class.util';

export class DatabaseInfoDto {
  @ApiProperty({
    description: 'User assigned database name', // not logical name, that is in url
    example: 'Health database',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Database engine/ file type',
    example: 'postgres', // e.g. postgres | mysql | mssql | oracle | sqlite | CSV
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({
    description: 'Hostname or IP address of the database server',
    example: 'db.internal.company.local',
  })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({
    description: 'Port the database listens on (as string)',
    example: '5432',
  })
  @IsOptional()
  @IsString()
  port?: string;

  @ApiPropertyOptional({
    description: 'Full connection URL (if provided, may supersede host/port)',
    format: 'uri',
    example: 'postgres://user:pass@db.internal.company.local:5432/analytics_dw',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'Database username',
    example: 'etl_service',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Database password (write-only; never returned)',
    writeOnly: true,
    example: '**********',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
export class DatabaseTestDto {
  @ApiProperty({
    description: 'Logical database name', // not logical name, that is in url
    example: 'health_db',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Database engine/ file type',
    example: 'postgres', // e.g. postgres | mysql | mssql | oracle | sqlite | CSV
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    description: 'Hostname or IP address of the database server',
    example: 'db.internal.company.local',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  host!: string;

  @ApiProperty({
    description: 'Port the database listens on (as string)',
    example: '5432',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  port!: string;

  @ApiProperty({
    description: 'Database username',
    writeOnly: true,
    example: 'db_admin',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    description: 'Database password (write-only; never returned)',
    writeOnly: true,
    example: '**********',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    description: 'SSL connection enabled',
    example: 'false',
  })
  @IsOptional()
  @IsBoolean()
  ssl!: boolean;

  @ApiPropertyOptional({
    description: 'Full connection URL (if provided, may supersede host/port)',
    format: 'uri',
    example: 'postgres://user:pass@db.internal.company.local:5432/analytics_dw',
  })
  @IsOptional()
  @IsString()
  url?: string;
}

export class ConnectionDto {
  @ApiPropertyOptional({
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

export class ConnectionRequestDto {
  @ApiPropertyOptional({
    description: 'Connection request',
    type: () => [RequestDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestDto)
  request?: RequestDto | null;

  @ApiPropertyOptional({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  requestId?: string | null;

  @ApiPropertyOptional({
    description:
      'Email of the organisation admin assigned to the project or owner',
    example: 'admin@university.edu',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  orgAdminEmail?: string | null;

  @ApiPropertyOptional({
    description: 'Temporary database connection details',
    type: Object,
    nullable: true,
  })
  @IsOptional()
  @IsJSON()
  tempDbDetails?: Prisma.JsonValue | null;
}
export class RequestDto {
  @ApiProperty({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsUUID()
  requestId!: string;

  @ApiProperty({
    type: Date,
    description: 'The date the request was created',
  })
  @IsDefined()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  createdDate!: Date;

  @ApiPropertyOptional({
    type: Date,
    description: 'The date the request was last modified',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => transformDateString(value))
  lastModified?: Date;

  @ApiProperty({
    enum: $Enums.RequestStatus,
    description: 'The status of the request',
    example: $Enums.RequestStatus.PENDING,
  })
  @IsEnum($Enums.RequestStatus)
  status: $Enums.RequestStatus;

  @ApiPropertyOptional({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsOptional()
  @IsUUID()
  requestorId?: string;

  @ApiPropertyOptional({
    description: 'Request comments',
    type: () => [RequestCommentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestCommentDto)
  comments?: RequestCommentDto[];
}

export class ConnectionRequestProjectInfoDto {
  @ApiProperty({
    description: 'The name of the project',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'The ID of the project',
  })
  @IsString()
  projectId!: string;
}

export class ConnectionRequestResponseDto {
  @ApiPropertyOptional({
    type: () => RequestDto,
    nullable: true,
    description: 'Request object, null if no request exists',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RequestDto)
  request?: RequestDto | null;

  @ApiProperty({
    type: () => ConnectionRequestProjectInfoDto,
    description: 'Project details',
  })
  @ValidateNested()
  @Type(() => ConnectionRequestProjectInfoDto)
  project: ConnectionRequestProjectInfoDto;
}

export class ConnectionDecisionDto {
  @ApiProperty({
    description: 'Approval decision for the connection request',
    example: true,
  })
  @IsDefined()
  @IsBoolean()
  isApproved!: boolean;

  @ApiPropertyOptional({
    description: 'Database connection details',
    type: DatabaseInfoDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DatabaseInfoDto)
  tempDbDetails?: DatabaseInfoDto;
}
