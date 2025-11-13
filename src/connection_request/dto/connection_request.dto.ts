import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DatabaseInfoDto {
  @ApiProperty({
    description: 'User assigned database name',
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
    type: String,
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

export class RequestDto {
  @ApiProperty({
    type: Date,
    description: 'The date the request was created',
  })
  @IsDate()
  @Type(() => Date)
  createdDate: Date;

  @ApiPropertyOptional({
    description: 'Incoming request identifier',
    format: 'uuid',
    example: '8b7e2f36-9217-4ea0-8d6e-b621fb6e5230',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiProperty({
    enum: $Enums.RequestStatus,
    description: 'The status of the request',
    example: $Enums.RequestStatus.PENDING,
  })
  @IsEnum($Enums.RequestStatus)
  status: $Enums.RequestStatus;
}

export class RequestProjectInfoDto {
  @ApiProperty({
    type: String,
    description: 'The name of the project',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    type: String,
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
  request: RequestDto | null;

  @ApiProperty({
    type: () => RequestProjectInfoDto,
    description: 'Project details',
  })
  @ValidateNested()
  @Type(() => RequestProjectInfoDto)
  project: RequestProjectInfoDto;
}
