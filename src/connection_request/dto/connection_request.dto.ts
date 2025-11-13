import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

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
