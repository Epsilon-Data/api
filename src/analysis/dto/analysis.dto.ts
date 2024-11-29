import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DescriptiveDto {
  @IsDefined()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsDefined()
  @ValidateNested({ each: true })
  @Type(() => VariableInfoDto)
  variables: { name: string; type: string; table: string }[];

  @IsDefined()
  @IsString({ each: true })
  calculate: string[];
}

export class VariableInfoDto {
  @IsDefined()
  @IsString()
  name: string;

  @IsDefined()
  @IsString()
  type: string;

  @IsDefined()
  @IsString()
  table: string;
}
