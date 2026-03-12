import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class GenerateTokenDto {
  @ApiProperty({
    description: 'Human-readable name for this token',
    example: 'Production server',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class GenerateTokenResponseDto {
  @ApiProperty({ description: 'Token ID (for revocation)' })
  id: string;

  @ApiProperty({ description: 'Token name' })
  name: string;

  @ApiProperty({ description: 'Full install token — shown only once' })
  installToken: string;

  @ApiProperty({ description: 'Token prefix for display (e.g. ept_a1b2c3...)' })
  tokenPrefix: string;

  @ApiProperty()
  createdAt: Date;
}

export class InstallTokenSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'First 12 chars of the token' })
  tokenPrefix: string;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional() lastUsedAt?: Date;
}

export class ProxyRegisterDto {
  @ApiProperty({ description: 'Install token from platform UI' })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  installToken: string;

  @ApiPropertyOptional({ description: 'Proxy version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Database type (e.g. postgres)' })
  @IsOptional()
  @IsString()
  dbType?: string;
}

export class ProxyRegisterResponseDto {
  @ApiProperty() proxyId: string;
  @ApiProperty() proxyToken: string;
  @ApiProperty() ratholeToken: string;
  @ApiProperty() noisePublicKey: string;
  @ApiProperty() serverAddr: string;
  @ApiProperty() serviceName: string;
  @ApiProperty() assignedPort: number;
}

export class ProxyHeartbeatDto {
  @ApiProperty({ description: 'Proxy token for authentication' })
  @IsDefined()
  @IsString()
  proxyToken: string;

  @ApiPropertyOptional() @IsOptional() @IsString() version?: string;
  @ApiPropertyOptional() @IsOptional() databaseReachable?: boolean;
  @ApiPropertyOptional() @IsOptional() tunnelConnected?: boolean;
  @ApiPropertyOptional() @IsOptional() uptimeSeconds?: number;
}

export class ProxyStatusResponseDto {
  @ApiProperty() proxyId: string;
  @ApiProperty({ enum: ['PENDING', 'ONLINE', 'OFFLINE'] }) status: string;
  @ApiPropertyOptional() version?: string;
  @ApiPropertyOptional() lastSeenAt?: Date;
  @ApiPropertyOptional() assignedPort?: number;
}

export class ProxyInfoResponseDto {
  @ApiProperty() proxyId: string;
  @ApiProperty() proxyToken: string;
  @ApiProperty() assignedPort: number;
  @ApiProperty({ enum: ['PENDING', 'ONLINE', 'OFFLINE'] }) status: string;
}

export class ProxyMetadataDto {
  @ApiProperty({ description: 'Proxy token for authentication' })
  @IsDefined()
  @IsString()
  proxyToken: string;

  @ApiProperty({ description: 'tbls JSON schema output' })
  @IsDefined()
  @IsObject()
  schema: Record<string, unknown>;

  @ApiProperty({ description: 'Mermaid ERD text' })
  @IsDefined()
  @IsString()
  erd: string;

  @ApiPropertyOptional({ description: 'Database type' })
  @IsOptional()
  @IsString()
  dbType?: string;
}

export class ProxyHeartbeatResponseDto {
  @ApiPropertyOptional({
    description: 'Action for the proxy to take',
    enum: ['crawl'],
  })
  action?: string;
}
