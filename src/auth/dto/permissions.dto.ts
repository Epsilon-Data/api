import { IsDefined, IsString } from 'class-validator';

export class PermissionsDto {
  @IsDefined()
  @IsString()
  rsid: string;

  @IsDefined()
  @IsString()
  rsname: string;

  @IsDefined()
  @IsString({ each: true })
  scopes: string[];
}
