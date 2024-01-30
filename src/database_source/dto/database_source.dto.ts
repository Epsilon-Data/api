import { Transform } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsNumber } from 'class-validator';

export class TemplateDto {
  @IsDefined()
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  projectId: number;

  @IsDefined()
  @IsNotEmpty()
  @Transform(({ value }) => JSON.parse(value))
  template: JSON;
}
