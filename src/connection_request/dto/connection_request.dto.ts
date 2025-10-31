import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DatabaseInfoDto {
  @ApiPropertyOptional({
    description: 'Logical database name (database)',
    example: 'analytics_dw',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Database engine/type',
    example: 'postgres', // e.g. postgres | mysql | mssql | oracle | sqlite
  })
  @IsOptional()
  @IsString()
  type?: string;

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

  @ApiPropertyOptional({
    description: 'Associated project identifier',
    format: 'uuid',
    example: '638c6f81-00c8-47f4-82ec-6b94240e757d',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
